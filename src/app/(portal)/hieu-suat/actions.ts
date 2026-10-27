"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canViewAllPerformance } from "@/lib/permissions";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { AI_MODEL, aiEnabled, anthropic, FALLBACK, textOf } from "@/lib/ai";
import { computePerformance, WEIGHTS, type PerfResult } from "@/lib/performance";
import { TASK_STATUS } from "@/lib/constants";
import { fmtDate, str } from "@/lib/utils";

const SYSTEM = `Bạn là chuyên viên tổ chức – nhân sự của Khoa Công nghệ Thông tin, Trường Cao đẳng Công nghiệp Bắc Ninh.
Nhiệm vụ: viết nhận xét hiệu suất công việc của một giảng viên dựa trên số liệu được cung cấp.

Yêu cầu:
- Viết bằng tiếng Việt, giọng văn hành chính, khách quan, mang tính xây dựng; xưng hô "thầy/cô" hoặc gọi theo họ tên.
- Chỉ dựa trên số liệu được cung cấp. Không suy đoán về hoàn cảnh cá nhân, không bịa thêm sự kiện.
- Cấu trúc 3 phần, mỗi phần có tiêu đề in đậm dạng **Điểm mạnh**, **Điểm cần cải thiện**, **Đề xuất**; mỗi phần 1–3 gạch đầu dòng ngắn.
- Tổng độ dài dưới 200 từ. Không lặp lại toàn bộ bảng số liệu.
- Đây là gợi ý hỗ trợ Trưởng khoa; kết luận cuối cùng thuộc về người đánh giá.`;

function fallbackSummary(name: string, p: PerfResult) {
  const strong: string[] = [];
  const improve: string[] = [];
  if ((p.timeliness ?? 0) >= 85) strong.push("Hoàn thành công việc đúng hạn ổn định.");
  else if (p.timeliness !== null) improve.push(`Tỷ lệ đúng hạn chưa cao (điểm tiến độ ${p.timeliness}/100), có ${p.counts.overdue} việc quá hạn.`);
  if (p.workload >= 70) strong.push("Đảm nhận khối lượng công việc lớn so với mặt bằng Khoa.");
  else if (p.workload < 40) improve.push("Khối lượng công việc đảm nhận còn thấp so với mặt bằng Khoa.");
  if ((p.quality ?? 0) >= 80) strong.push("Chất lượng sản phẩm được nghiệm thu đánh giá cao.");
  else if (p.quality !== null && p.quality < 65) improve.push(`Chất lượng nghiệm thu trung bình ${p.quality}/100, cần chú ý tiêu chí nghiệm thu.`);
  return [
    `**Điểm mạnh**\n${(strong.length ? strong : ["Đã tham gia đầy đủ các công việc được giao."]).map((s) => `- ${s}`).join("\n")}`,
    `**Điểm cần cải thiện**\n${(improve.length ? improve : ["Không có điểm đáng lưu ý."]).map((s) => `- ${s}`).join("\n")}`,
    `**Đề xuất**\n- ${p.total >= 85 ? `Ghi nhận, biểu dương thành tích của ${name}.` : "Trao đổi định kỳ với người giao việc để chủ động kế hoạch, ưu tiên các việc sắp đến hạn."}`,
    `\n_(Nhận xét tự động theo quy tắc – chưa cấu hình Claude API)_`,
  ].join("\n\n");
}

export async function generateReview(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const me = await requireUser();
    const userId = str(fd, "userId");
    const days = Number(str(fd, "days")) || 90;
    if (userId !== me.id && !canViewAllPerformance(me)) return fail("Bạn không có quyền đánh giá người khác.");

    const since = new Date(Date.now() - days * 86_400_000);
    const [staff, tasks, person] = await Promise.all([
      db.user.findMany({ where: { active: true, role: { not: "ADMIN" } }, select: { id: true } }),
      db.task.findMany({ where: { dueAt: { gte: since } } }),
      db.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    const all = computePerformance(staff.map((s) => s.id), tasks);
    const p = all.find((r) => r.userId === userId);
    if (!p || p.counts.total === 0) return fail("Chưa có công việc nào trong kỳ để đánh giá.");
    const avg = all.filter((r) => r.counts.total > 0).reduce((a, r, _, arr) => a + r.total / arr.length, 0);

    const mine = tasks.filter((t) => t.assigneeId === userId);
    const facts = {
      giang_vien: person.name,
      ky_danh_gia: `${days} ngày gần nhất (từ ${fmtDate(since)})`,
      trong_so: WEIGHTS,
      diem_tong: p.total,
      xep_loai: p.rating.label,
      diem_trung_binh_khoa: Math.round(avg * 10) / 10,
      thanh_phan: { tien_do: p.timeliness, khoi_luong: p.workload, chat_luong: p.quality },
      so_lieu: p.counts,
      cong_viec: mine.slice(0, 25).map((t) => ({
        ten: t.title,
        trang_thai: TASK_STATUS[t.status]?.label,
        han: fmtDate(t.dueAt),
        nop: t.submittedAt ? fmtDate(t.submittedAt) : null,
        khoi_luong: t.workload,
        chat_luong_sao: t.qualityScore,
      })),
    };

    let summary: string;
    if (aiEnabled()) {
      let res: Anthropic.Beta.BetaMessage;
      try {
        res = await anthropic().beta.messages.create({
          model: AI_MODEL,
          max_tokens: 4000,
          output_config: { effort: "low" },
          ...FALLBACK,
          system: SYSTEM,
          messages: [{ role: "user", content: `Số liệu đánh giá (JSON):\n${JSON.stringify(facts, null, 2)}\n\nHãy viết nhận xét.` }],
        });
      } catch (e) {
        if (e instanceof Anthropic.APIError) return fail(`Lỗi gọi Claude API (${e.status ?? "mạng"}). Kiểm tra ANTHROPIC_API_KEY và hạn mức.`);
        throw e;
      }
      if (res.stop_reason === "refusal") return fail("Mô hình AI từ chối yêu cầu này. Vui lòng thử lại sau.");
      summary = textOf(res.content);
      if (!summary) return fail("AI không trả về nội dung. Vui lòng thử lại.");
    } else {
      summary = fallbackSummary(person.name, p);
    }

    await db.performanceReview.create({ data: { userId, period: `${days} ngày`, score: p.total, summary } });
    revalidatePath("/hieu-suat");
    return ok("Đã tạo nhận xét hiệu suất.");
  });
}

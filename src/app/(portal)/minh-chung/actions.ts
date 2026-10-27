"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasRole, requireRole, requireUser } from "@/lib/auth";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { saveUploads } from "@/lib/uploads";
import { fromLocalInput, str } from "@/lib/utils";

const refresh = () => revalidatePath("/minh-chung", "layout");

/** Tiêu chí nhập mỗi dòng: "TC1.1 | Tên tiêu chí" (hoặc chỉ tên – hệ thống tự đánh mã) */
function parseCriteria(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [a, ...rest] = line.split("|").map((s) => s.trim());
      return rest.length ? { code: a, title: rest.join(" | "), order: i } : { code: `TC${i + 1}`, title: a, order: i };
    });
}

export async function createCampaign(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await attempt(async () => {
    const user = await requireRole("HEAD", "ASSISTANT");
    const title = str(fd, "title");
    const agency = str(fd, "agency");
    const openAt = fromLocalInput(str(fd, "openAt"));
    const closeAt = fromLocalInput(str(fd, "closeAt"));
    const criteria = parseCriteria(str(fd, "criteria"));
    if (!title || !agency || !openAt || !closeAt) return fail("Vui lòng nhập đủ tên đợt, cơ quan và thời hạn.");
    if (closeAt <= openAt) return fail("Hạn nộp phải sau ngày mở.");
    if (!criteria.length) return fail("Cần ít nhất một tiêu chí.");
    const c = await db.evidenceCampaign.create({
      data: { title, agency, openAt, closeAt, description: str(fd, "description") || null, createdById: user.id, criteria: { create: criteria } },
    });
    id = c.id;
    return ok("Đã tạo đợt minh chứng.");
  });
  if (res?.ok) {
    refresh();
    redirect(`/minh-chung/${id}`);
  }
  return res;
}

export async function submitEvidence(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireUser();
    const campaignId = str(fd, "campaignId");
    const criterionId = str(fd, "criterionId");
    const title = str(fd, "title");
    if (!criterionId || !title) return fail("Vui lòng chọn tiêu chí và nhập tên minh chứng.");
    const campaign = await db.evidenceCampaign.findUniqueOrThrow({ where: { id: campaignId } });
    if (campaign.closeAt < new Date()) return fail("Đợt minh chứng đã hết hạn nộp.");
    const hasFile = fd.getAll("files").some((f) => f instanceof File && f.size > 0);
    if (!hasFile) return fail("Vui lòng đính kèm ít nhất một tệp minh chứng.");
    const ev = await db.evidence.create({
      data: {
        campaignId,
        criterionId,
        title,
        description: str(fd, "description") || null,
        submitterId: user.id,
        logs: { create: { actorId: user.id, action: "SUBMIT" } },
      },
    });
    await saveUploads(fd, user.id, { evidenceId: ev.id });
    refresh();
    return ok("Đã nộp minh chứng. Hồ sơ được chuyển tự động tới Trợ lý khoa để duyệt cấp 1.");
  });
}

/**
 * Duyệt minh chứng theo luồng tự động:
 * SUBMITTED --(Trợ lý)--> ASSISTANT_APPROVED --(Trưởng khoa)--> APPROVED
 * Bất kỳ cấp nào cũng có thể trả về REJECTED kèm yêu cầu bổ sung.
 */
export async function reviewEvidence(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireRole("HEAD", "ASSISTANT");
    const id = str(fd, "id");
    const decision = str(fd, "decision");
    const comment = str(fd, "comment") || null;
    const ev = await db.evidence.findUniqueOrThrow({ where: { id } });

    if (decision === "reject") {
      if (!comment) return fail("Vui lòng ghi rõ nội dung cần bổ sung khi trả hồ sơ.");
      if (!["SUBMITTED", "ASSISTANT_APPROVED"].includes(ev.status)) return fail("Hồ sơ không ở trạng thái chờ duyệt.");
      await db.evidence.update({ where: { id }, data: { status: "REJECTED", logs: { create: { actorId: user.id, action: "REJECT", comment } } } });
      refresh();
      return ok("Đã trả hồ sơ, yêu cầu giảng viên bổ sung.");
    }

    if (ev.status === "SUBMITTED" && hasRole(user, "ASSISTANT")) {
      await db.evidence.update({
        where: { id },
        data: { status: "ASSISTANT_APPROVED", logs: { create: { actorId: user.id, action: "APPROVE_L1", comment } } },
      });
      refresh();
      return ok("Đã duyệt cấp 1. Hồ sơ được chuyển tự động lên Trưởng khoa.");
    }
    if (ev.status === "ASSISTANT_APPROVED" && hasRole(user, "HEAD")) {
      await db.evidence.update({ where: { id }, data: { status: "APPROVED", logs: { create: { actorId: user.id, action: "APPROVE_L2", comment } } } });
      refresh();
      return ok("Đã phê duyệt minh chứng.");
    }
    return fail("Bạn không có quyền duyệt hồ sơ ở bước này.");
  });
}

export async function resubmitEvidence(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireUser();
    const id = str(fd, "id");
    const ev = await db.evidence.findUniqueOrThrow({ where: { id } });
    if (ev.submitterId !== user.id) return fail("Chỉ người nộp mới được bổ sung hồ sơ.");
    if (ev.status !== "REJECTED") return fail("Hồ sơ không ở trạng thái cần bổ sung.");
    await saveUploads(fd, user.id, { evidenceId: id });
    await db.evidence.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        description: str(fd, "description") || ev.description,
        logs: { create: { actorId: user.id, action: "RESUBMIT", comment: str(fd, "comment") || null } },
      },
    });
    refresh();
    return ok("Đã nộp lại hồ sơ.");
  });
}

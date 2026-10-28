// Chuyển dữ liệu cũ sang cấu trúc mới. Chạy một lần trên CSDL đang dùng (an toàn khi chạy lại):
//   npx tsx scripts/migrate-data.ts
// 1. Gộp vai trò Trưởng khoa + Trợ lý khoa thành "Quản lý khoa" (MANAGER).
// 2. Thời khóa biểu: mỗi phiên bản giữ bộ phân công riêng (TeachingAssignment.timetableId).
//    Phân công cũ đang được các phiên bản dùng chung sẽ được tách/sao chép cho từng phiên bản.
// 3. Nếu chưa có Kế hoạch giảng dạy của lớp / Đăng ký môn dạy: tạo từ thời khóa biểu hiện có.
// Không sửa lịch sử duyệt minh chứng.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const users = await db.user.updateMany({ where: { role: { in: ["HEAD", "ASSISTANT"] } }, data: { role: "MANAGER" } });
  const evidences = await db.evidence.updateMany({ where: { status: "ASSISTANT_APPROVED" }, data: { status: "SUBMITTED" } });
  console.log(`✔ Vai trò: ${users.count} tài khoản → Quản lý khoa; ${evidences.count} minh chứng về trạng thái chờ duyệt.`);

  // ── Tách phân công theo từng phiên bản TKB ──
  let attached = 0;
  let cloned = 0;
  const timetables = await db.timetable.findMany({ orderBy: [{ status: "desc" }, { createdAt: "desc" }], select: { id: true } });
  for (const tt of timetables) {
    const entries = await db.timetableEntry.findMany({ where: { timetableId: tt.id }, include: { assignment: true } });
    const mapped = new Map<string, string>(); // assignment cũ → assignment của phiên bản này
    for (const e of entries) {
      const a = e.assignment;
      if (a.timetableId === tt.id) continue;
      let target = mapped.get(a.id);
      if (!target) {
        if (a.timetableId === null) {
          await db.teachingAssignment.update({ where: { id: a.id }, data: { timetableId: tt.id } });
          target = a.id;
          attached++;
        } else {
          const copy = await db.teachingAssignment.create({
            data: { lecturerId: a.lecturerId, classGroupId: a.classGroupId, subjectId: a.subjectId, sessionsPerWeek: a.sessionsPerWeek, timetableId: tt.id },
          });
          target = copy.id;
          cloned++;
        }
        mapped.set(a.id, target);
      }
      if (target !== a.id) await db.timetableEntry.update({ where: { id: e.id }, data: { assignmentId: target } });
    }
  }
  console.log(`✔ Phân công theo phiên bản TKB: gắn ${attached}, sao chép ${cloned}.`);

  // ── Kế hoạch giảng dạy & đăng ký môn từ TKB đang công bố (hoặc mới nhất) ──
  const source = await db.timetable.findFirst({ orderBy: [{ status: "desc" }, { createdAt: "desc" }], include: { assignments: true } });
  if (source && (await db.classSubject.count()) === 0) {
    const plan = new Map<string, { classGroupId: string; subjectId: string; n: number }>();
    for (const a of source.assignments) {
      const k = `${a.classGroupId}|${a.subjectId}`;
      const p = plan.get(k) ?? { classGroupId: a.classGroupId, subjectId: a.subjectId, n: 0 };
      p.n += a.sessionsPerWeek;
      plan.set(k, p);
    }
    for (const p of plan.values()) {
      await db.classSubject.create({ data: { classGroupId: p.classGroupId, subjectId: p.subjectId, sessionsPerWeek: Math.min(5, p.n) } });
    }
    console.log(`✔ Tạo ${plan.size} dòng Kế hoạch giảng dạy của lớp từ "${source.name}".`);
  }
  if (source && (await db.teachingPreference.count()) === 0) {
    const pairs = new Set(source.assignments.map((a) => `${a.lecturerId}|${a.subjectId}`));
    for (const p of pairs) {
      const [userId, subjectId] = p.split("|");
      await db.teachingPreference.create({ data: { userId, subjectId } });
    }
    console.log(`✔ Tạo ${pairs.size} đăng ký môn dạy từ các môn giảng viên đang dạy.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

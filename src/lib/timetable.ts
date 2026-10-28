import "server-only";
import { db } from "./db";
import { findConflicts, planTimetable, type Kind, type PlanInput, type PlanResult, type RoomType, type SchedAssignment } from "./scheduler";
import { SUBJECT_KIND } from "./constants";

export const entryInclude = {
  room: true,
  assignment: { include: { lecturer: { select: { id: true, name: true, title: true } }, classGroup: true, subject: true } },
} as const;

export async function loadTimetable(id: string) {
  const tt = await db.timetable.findUnique({ where: { id }, include: { entries: { include: entryInclude } } });
  if (!tt) return null;
  const rooms = await db.room.findMany();
  const asgById = new Map<string, SchedAssignment>(
    tt.entries.map((e) => [
      e.assignmentId,
      { id: e.assignmentId, lecturerId: e.assignment.lecturerId, classGroupId: e.assignment.classGroupId, kind: e.assignment.subject.kind as Kind, sessionsPerWeek: e.assignment.sessionsPerWeek },
    ]),
  );
  const conflicts = findConflicts(tt.entries, asgById, rooms.map((r) => ({ id: r.id, type: r.type as RoomType })));
  return { ...tt, conflicts };
}

export type LoadedTimetable = NonNullable<Awaited<ReturnType<typeof loadTimetable>>>;
export type LoadedEntry = LoadedTimetable["entries"][number];

/**
 * Gom dữ liệu đầu vào cho thuật toán từ CSDL:
 * - Kế hoạch giảng dạy của lớp (ClassSubject) = nhu cầu.
 * - Phân công cố định (TeachingAssignment có timetableId = null).
 * - Nhóm giảng viên: mọi GV đang hoạt động có vai trò Giảng viên, cộng thêm bất kỳ ai
 *   (kể cả Quản lý khoa) đã đăng ký môn dạy hoặc có phân công cố định.
 * - Buổi đã khóa của phiên bản TKB nguồn (nếu xếp lại từ một phiên bản).
 */
export async function loadPlanInput(lockedFromTimetableId?: string): Promise<PlanInput> {
  const [plans, fixed, users, rooms, classes, subjects, locked] = await Promise.all([
    db.classSubject.findMany({ include: { subject: true } }),
    db.teachingAssignment.findMany({ where: { timetableId: null }, include: { subject: true } }),
    db.user.findMany({
      where: { active: true, OR: [{ role: "LECTURER" }, { teachingPrefs: { some: {} } }, { assignments: { some: { timetableId: null } } }] },
      select: { id: true, name: true, teachingPrefs: { select: { subjectId: true } } },
    }),
    db.room.findMany(),
    db.classGroup.findMany({ select: { id: true, code: true } }),
    db.subject.findMany({ select: { id: true, code: true, name: true } }),
    lockedFromTimetableId
      ? db.timetableEntry.findMany({ where: { timetableId: lockedFromTimetableId, locked: true }, include: { assignment: { include: { subject: true } } } })
      : Promise.resolve([]),
  ]);
  return {
    demands: plans.map((p) => ({ classGroupId: p.classGroupId, subjectId: p.subjectId, kind: p.subject.kind as Kind, sessions: p.sessionsPerWeek })),
    fixed: fixed.map((f) => ({ lecturerId: f.lecturerId, classGroupId: f.classGroupId, subjectId: f.subjectId, kind: f.subject.kind as Kind, sessions: f.sessionsPerWeek })),
    lecturers: users.map((u) => ({ id: u.id, registered: u.teachingPrefs.map((p) => p.subjectId) })),
    rooms: rooms.map((r) => ({ id: r.id, type: r.type as RoomType })),
    locked: locked.map((e) => ({
      lecturerId: e.assignment.lecturerId,
      classGroupId: e.assignment.classGroupId,
      subjectId: e.assignment.subjectId,
      kind: e.assignment.subject.kind as Kind,
      day: e.day,
      slot: e.slot,
      roomId: e.roomId,
    })),
    lecturerNames: Object.fromEntries(users.map((u) => [u.id, u.name])),
    classNames: Object.fromEntries(classes.map((c) => [c.id, c.code])),
    subjectNames: Object.fromEntries(subjects.map((s) => [s.id, `${s.code} ${s.name}`])),
  };
}

/** Chạy trọn quy trình (phân bổ giảng viên → xếp lịch) trên dữ liệu hiện tại */
export async function runScheduler(lockedFromTimetableId?: string): Promise<PlanResult> {
  return planTimetable(await loadPlanInput(lockedFromTimetableId));
}

/** Lưu kết quả thành một phiên bản TKB mới (nháp), kèm bộ phân công riêng của phiên bản */
export async function saveTimetable(name: string, result: PlanResult) {
  return db.$transaction(async (tx) => {
    const note = [
      `Xếp tự động: ${result.entries.length} buổi, ${result.stats.ms}ms.`,
      result.allocation.unassigned.length ? `Chưa xếp được ${result.allocation.unassigned.reduce((a, u) => a + u.sessions, 0)} buổi.` : "",
      ...result.warnings,
    ]
      .filter(Boolean)
      .join(" ");
    const tt = await tx.timetable.create({ data: { name, note } });
    const idByKey = new Map<string, string>();
    for (const a of result.allocation.allocations) {
      const row = await tx.teachingAssignment.create({
        data: {
          lecturerId: a.lecturerId,
          classGroupId: a.classGroupId,
          subjectId: a.subjectId,
          sessionsPerWeek: a.sessions,
          outsideRegistration: a.outsideRegistration,
          timetableId: tt.id,
        },
      });
      idByKey.set(a.key, row.id);
    }
    await tx.timetableEntry.createMany({
      data: result.entries.map((e) => ({ timetableId: tt.id, assignmentId: idByKey.get(e.assignmentId)!, day: e.day, slot: e.slot, roomId: e.roomId, locked: !!e.locked })),
    });
    return tt;
  }, { timeout: 30_000 });
}

export function entryHours(kind: string) {
  return SUBJECT_KIND[kind]?.hours ?? 5;
}

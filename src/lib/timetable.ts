import "server-only";
import { db } from "./db";
import { findConflicts, solveTimetable, type Kind, type RoomType, type SchedAssignment, type SolveResult } from "./scheduler";
import { SESSIONS_PER_LECTURER, SUBJECT_KIND } from "./constants";

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

/** Chạy thuật toán trên dữ liệu phân công hiện tại; giữ các buổi đã khóa của TKB nguồn (nếu có) */
export async function runScheduler(lockedFromTimetableId?: string): Promise<SolveResult> {
  const [assignments, rooms, locked] = await Promise.all([
    db.teachingAssignment.findMany({ include: { lecturer: true, classGroup: true, subject: true } }),
    db.room.findMany(),
    lockedFromTimetableId ? db.timetableEntry.findMany({ where: { timetableId: lockedFromTimetableId, locked: true } }) : Promise.resolve([]),
  ]);
  return solveTimetable({
    assignments: assignments.map((a) => ({
      id: a.id,
      lecturerId: a.lecturerId,
      classGroupId: a.classGroupId,
      kind: a.subject.kind as Kind,
      sessionsPerWeek: a.sessionsPerWeek,
      label: `${a.lecturer.name} – ${a.classGroup.code} – ${a.subject.name}`,
    })),
    rooms: rooms.map((r) => ({ id: r.id, type: r.type as RoomType })),
    locked: locked.map((e) => ({ assignmentId: e.assignmentId, day: e.day, slot: e.slot, roomId: e.roomId })),
    requiredPerLecturer: SESSIONS_PER_LECTURER,
    lecturerNames: Object.fromEntries(assignments.map((a) => [a.lecturerId, a.lecturer.name])),
    classNames: Object.fromEntries(assignments.map((a) => [a.classGroupId, a.classGroup.code])),
  });
}

export function entryHours(kind: string) {
  return SUBJECT_KIND[kind]?.hours ?? 5;
}

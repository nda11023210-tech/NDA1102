"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { runScheduler } from "@/lib/timetable";
import { str } from "@/lib/utils";

const refresh = () => revalidatePath("/thoi-khoa-bieu", "layout");

export async function generateTimetable(_: ActionState, fd: FormData): Promise<ActionState> {
  let newId = "";
  const res = await attempt(async () => {
    await requireRole("MANAGER");
    const keepFrom = str(fd, "keepLockedFrom") || undefined;
    const result = await runScheduler(keepFrom);
    if (!result.ok) return fail(result.errors.join(" "));
    const name = str(fd, "name") || `Bản xếp tự động ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}`;
    const tt = await db.timetable.create({
      data: {
        name,
        note: `Xếp tự động: ${result.stats.variables} buổi, ${result.stats.steps} bước tìm kiếm, ${result.stats.ms}ms. ${result.warnings.join(" ")}`.trim(),
        entries: { create: result.entries.map((e) => ({ assignmentId: e.assignmentId, day: e.day, slot: e.slot, roomId: e.roomId, locked: !!e.locked })) },
      },
    });
    newId = tt.id;
    return ok("Đã xếp thời khóa biểu.");
  });
  if (res?.ok) {
    refresh();
    redirect(`/thoi-khoa-bieu?tt=${newId}`);
  }
  return res;
}

export async function publishTimetable(fd: FormData) {
  await requireRole("MANAGER");
  const id = str(fd, "id");
  await db.$transaction([
    db.timetable.updateMany({ where: { status: "PUBLISHED" }, data: { status: "DRAFT" } }),
    db.timetable.update({ where: { id }, data: { status: "PUBLISHED" } }),
  ]);
  refresh();
}

export async function deleteTimetable(fd: FormData) {
  await requireRole("MANAGER");
  await db.timetable.delete({ where: { id: str(fd, "id") } });
  refresh();
  redirect("/thoi-khoa-bieu");
}

/** Di chuyển một buổi sang ô khác (chỉnh tay). Tự chọn phòng trống đúng loại nếu không chỉ định. */
export async function moveEntry(entryId: string, day: number, slot: number, roomId?: string): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    if (day < 0 || day > 4 || slot < 0 || slot > 1) return fail("Ô thời gian không hợp lệ.");
    const entry = await db.timetableEntry.findUniqueOrThrow({ where: { id: entryId }, include: { assignment: { include: { subject: true } } } });
    let targetRoom = roomId;
    if (!targetRoom) {
      const wantType = entry.assignment.subject.kind === "MD" ? "LAB" : "THEORY";
      const busy = await db.timetableEntry.findMany({ where: { timetableId: entry.timetableId, day, slot, NOT: { id: entryId } }, select: { roomId: true } });
      const busyIds = new Set(busy.map((b) => b.roomId));
      const current = await db.room.findUnique({ where: { id: entry.roomId } });
      if (current && current.type === wantType && !busyIds.has(current.id)) targetRoom = current.id;
      else targetRoom = (await db.room.findFirst({ where: { type: wantType, id: { notIn: [...busyIds] } }, orderBy: { code: "asc" } }))?.id;
      if (!targetRoom) targetRoom = entry.roomId; // hết phòng: giữ phòng cũ, xung đột sẽ được đánh dấu
    }
    await db.timetableEntry.update({ where: { id: entryId }, data: { day, slot, roomId: targetRoom, locked: true } });
    await db.timetable.update({ where: { id: entry.timetableId }, data: { updatedAt: new Date() } });
    refresh();
    return ok("Đã chuyển buổi học và khóa vị trí.");
  });
}

export async function toggleLock(entryId: string): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const e = await db.timetableEntry.findUniqueOrThrow({ where: { id: entryId } });
    await db.timetableEntry.update({ where: { id: entryId }, data: { locked: !e.locked } });
    refresh();
    return ok(e.locked ? "Đã mở khóa buổi học." : "Đã khóa buổi học.");
  });
}

// ───────── Dữ liệu nền: phòng, lớp, học phần, phân công ─────────

export async function saveRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const code = str(fd, "code").toUpperCase();
    const type = str(fd, "type");
    if (!code || !["LAB", "THEORY"].includes(type)) return fail("Vui lòng nhập mã phòng và loại phòng.");
    await db.room.upsert({
      where: { code },
      create: { code, name: str(fd, "name") || code, type, capacity: Number(str(fd, "capacity")) || 40 },
      update: { name: str(fd, "name") || code, type, capacity: Number(str(fd, "capacity")) || 40 },
    });
    refresh();
    return ok(`Đã lưu phòng ${code}.`);
  });
}

export async function saveClassGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const code = str(fd, "code").toUpperCase();
    if (!code) return fail("Vui lòng nhập mã lớp.");
    await db.classGroup.upsert({
      where: { code },
      create: { code, name: str(fd, "name") || code, size: Number(str(fd, "size")) || 35 },
      update: { name: str(fd, "name") || code, size: Number(str(fd, "size")) || 35 },
    });
    refresh();
    return ok(`Đã lưu lớp ${code}.`);
  });
}

export async function saveSubject(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const code = str(fd, "code").toUpperCase();
    const kind = str(fd, "kind");
    const name = str(fd, "name");
    if (!code || !name || !["MD", "MH"].includes(kind)) return fail("Vui lòng nhập mã, tên và loại học phần.");
    await db.subject.upsert({
      where: { code },
      create: { code, name, kind, hours: Number(str(fd, "hours")) || 60 },
      update: { name, kind, hours: Number(str(fd, "hours")) || 60 },
    });
    refresh();
    return ok(`Đã lưu học phần ${code}.`);
  });
}

export async function createAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const lecturerId = str(fd, "lecturerId");
    const classGroupId = str(fd, "classGroupId");
    const subjectId = str(fd, "subjectId");
    const sessionsPerWeek = Number(str(fd, "sessionsPerWeek"));
    if (!lecturerId || !classGroupId || !subjectId) return fail("Vui lòng chọn giảng viên, lớp và học phần.");
    if (!(sessionsPerWeek >= 1 && sessionsPerWeek <= 5)) return fail("Số buổi/tuần từ 1 đến 5.");
    await db.teachingAssignment.create({ data: { lecturerId, classGroupId, subjectId, sessionsPerWeek } });
    refresh();
    return ok("Đã thêm phân công.");
  });
}

export async function deleteAssignment(fd: FormData) {
  await requireRole("MANAGER");
  await db.teachingAssignment.delete({ where: { id: str(fd, "id") } });
  refresh();
}

export async function updateAssignmentSessions(fd: FormData) {
  await requireRole("MANAGER");
  const n = Number(str(fd, "sessionsPerWeek"));
  if (n >= 1 && n <= 5) await db.teachingAssignment.update({ where: { id: str(fd, "id") }, data: { sessionsPerWeek: n } });
  refresh();
}

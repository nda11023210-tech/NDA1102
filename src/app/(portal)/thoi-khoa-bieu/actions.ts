"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { runScheduler, saveTimetable } from "@/lib/timetable";
import { MAX_PER_LECTURER } from "@/lib/scheduler";
import { str } from "@/lib/utils";

const refresh = () => revalidatePath("/thoi-khoa-bieu", "layout");

export async function generateTimetable(_: ActionState, fd: FormData): Promise<ActionState> {
  let newId = "";
  const res = await attempt(async () => {
    await requireRole("MANAGER");
    const keepFrom = str(fd, "keepLockedFrom") || undefined;
    const result = await runScheduler(keepFrom);
    if (!result.ok) return fail(result.errors.join(" "));
    if (!result.entries.length) return fail("Chưa có kế hoạch giảng dạy nào để xếp. Hãy nhập Kế hoạch giảng dạy của lớp trong mục Phân công & dữ liệu nền.");
    const name = str(fd, "name") || `Bản xếp tự động ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}`;
    newId = (await saveTimetable(name, result)).id;
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

export async function unpublishTimetable(fd: FormData) {
  await requireRole("MANAGER");
  await db.timetable.update({ where: { id: str(fd, "id") }, data: { status: "DRAFT" } });
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
    const used = await db.teachingAssignment.aggregate({ where: { lecturerId, timetableId: null }, _sum: { sessionsPerWeek: true } });
    if ((used._sum.sessionsPerWeek ?? 0) + sessionsPerWeek > MAX_PER_LECTURER) return fail(`Giảng viên này đã có ${used._sum.sessionsPerWeek ?? 0} buổi cố định – tối đa ${MAX_PER_LECTURER} buổi/tuần.`);
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

// ───────── Kế hoạch giảng dạy của lớp ─────────

export async function saveClassSubject(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const classGroupId = str(fd, "classGroupId");
    const subjectId = str(fd, "subjectId");
    const sessionsPerWeek = Number(str(fd, "sessionsPerWeek"));
    if (!classGroupId || !subjectId) return fail("Vui lòng chọn lớp và học phần.");
    if (!(sessionsPerWeek >= 1 && sessionsPerWeek <= 5)) return fail("Số buổi/tuần từ 1 đến 5 (mỗi ngày tối đa 1 buổi cùng môn).");
    const others = await db.classSubject.aggregate({ where: { classGroupId, NOT: { subjectId } }, _sum: { sessionsPerWeek: true } });
    if ((others._sum.sessionsPerWeek ?? 0) + sessionsPerWeek > 10) return fail("Tổng số buổi của lớp vượt quá 10 buổi/tuần.");
    await db.classSubject.upsert({
      where: { classGroupId_subjectId: { classGroupId, subjectId } },
      create: { classGroupId, subjectId, sessionsPerWeek },
      update: { sessionsPerWeek },
    });
    refresh();
    return ok("Đã lưu kế hoạch giảng dạy.");
  });
}

export async function deleteClassSubject(fd: FormData) {
  await requireRole("MANAGER");
  await db.classSubject.delete({ where: { id: str(fd, "id") } });
  refresh();
}

// ───────── Xóa dữ liệu nền ─────────
// Không cho xóa khi còn được dùng trong một phiên bản TKB, để không làm hỏng lịch đã xếp/công bố.

async function usedInTimetables(where: { roomId?: string; classGroupId?: string; subjectId?: string }) {
  const entries = await db.timetableEntry.findMany({
    where: where.roomId ? { roomId: where.roomId } : { assignment: { classGroupId: where.classGroupId, subjectId: where.subjectId } },
    select: { timetable: { select: { name: true } } },
    distinct: ["timetableId"],
  });
  return entries.map((e) => e.timetable.name);
}

const inUseMessage = (what: string, names: string[]) =>
  `${what} đang được dùng trong thời khóa biểu: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}. Hãy xóa các phiên bản đó trước (bản đang công bố cần hủy công bố rồi xóa).`;

export async function deleteRoom(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const id = str(fd, "id");
    const names = await usedInTimetables({ roomId: id });
    if (names.length) return fail(inUseMessage("Phòng", names));
    const r = await db.room.delete({ where: { id } });
    refresh();
    return ok(`Đã xóa phòng ${r.code}.`);
  });
}

export async function deleteClassGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const id = str(fd, "id");
    const names = await usedInTimetables({ classGroupId: id });
    if (names.length) return fail(inUseMessage("Lớp", names));
    const c = await db.classGroup.delete({ where: { id } }); // xóa kèm kế hoạch giảng dạy và phân công cố định của lớp
    refresh();
    return ok(`Đã xóa lớp ${c.code}.`);
  });
}

export async function deleteSubject(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const id = str(fd, "id");
    const names = await usedInTimetables({ subjectId: id });
    if (names.length) return fail(inUseMessage("Học phần", names));
    const s = await db.subject.delete({ where: { id } }); // xóa kèm kế hoạch, phân công cố định và đăng ký môn
    refresh();
    return ok(`Đã xóa học phần ${s.code}.`);
  });
}

// ───────── Đăng ký môn dạy (mọi người dùng) ─────────

export async function saveTeachingPreferences(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireUser();
    const subjectIds = [...new Set(fd.getAll("subjectId").map(String).filter(Boolean))];
    const valid = await db.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true } });
    await db.$transaction([
      db.teachingPreference.deleteMany({ where: { userId: user.id } }),
      db.teachingPreference.createMany({ data: valid.map((s) => ({ userId: user.id, subjectId: s.id })) }),
    ]);
    refresh();
    return ok(valid.length ? `Đã lưu ${valid.length} môn bạn có thể dạy.` : "Đã xóa toàn bộ đăng ký môn dạy của bạn.");
  });
}

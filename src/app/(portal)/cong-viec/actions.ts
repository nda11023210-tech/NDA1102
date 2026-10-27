"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { saveUploads } from "@/lib/uploads";
import { TASK_PRIORITY } from "@/lib/constants";
import { fromLocalInput, str } from "@/lib/utils";

const refresh = (id?: string) => {
  revalidatePath("/cong-viec");
  revalidatePath("/hieu-suat");
  if (id) revalidatePath(`/cong-viec/${id}`);
};

export async function createTask(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireRole("HEAD", "ASSISTANT");
    const title = str(fd, "title");
    const dueAt = fromLocalInput(str(fd, "dueAt"));
    const assigneeIds = fd.getAll("assigneeId").map(String).filter(Boolean);
    const priority = str(fd, "priority") || "MEDIUM";
    const workload = Math.min(5, Math.max(1, Number(str(fd, "workload")) || 2));
    if (!title || !dueAt || !assigneeIds.length) return fail("Vui lòng nhập tên công việc, hạn chót và chọn người thực hiện.");
    if (!TASK_PRIORITY[priority]) return fail("Mức ưu tiên không hợp lệ.");
    for (const assigneeId of assigneeIds) {
      const t = await db.task.create({
        data: {
          title,
          description: str(fd, "description") || null,
          criteria: str(fd, "criteria") || null,
          assigneeId,
          assignerId: user.id,
          priority,
          workload,
          dueAt,
        },
      });
      // Tệp đính kèm chỉ lưu cho công việc đầu tiên khi giao cho nhiều người (tránh nhân bản tệp)
      if (assigneeId === assigneeIds[0]) await saveUploads(fd, user.id, { taskId: t.id });
    }
    refresh();
    return ok(assigneeIds.length > 1 ? `Đã giao việc cho ${assigneeIds.length} người.` : "Đã giao việc.");
  });
}

export async function updateTaskStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireUser();
    const id = str(fd, "id");
    const intent = str(fd, "intent");
    const task = await db.task.findUniqueOrThrow({ where: { id } });
    const isAssignee = task.assigneeId === user.id;
    const isAssigner = task.assignerId === user.id || user.role === "ADMIN" || user.role === "HEAD";
    const note = str(fd, "note");

    if (intent === "start" && isAssignee && ["TODO", "REVISION"].includes(task.status)) {
      await db.task.update({ where: { id }, data: { status: "IN_PROGRESS" } });
      refresh(id);
      return ok("Đã chuyển sang Đang thực hiện.");
    }
    if (intent === "submit" && isAssignee && ["TODO", "IN_PROGRESS", "REVISION"].includes(task.status)) {
      await saveUploads(fd, user.id, { taskId: id });
      await db.task.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
      if (note) await db.taskComment.create({ data: { taskId: id, userId: user.id, content: `[Báo cáo kết quả] ${note}` } });
      refresh(id);
      return ok("Đã nộp kết quả, chờ nghiệm thu.");
    }
    if (intent === "accept" && isAssigner && task.status === "SUBMITTED") {
      const score = Number(str(fd, "qualityScore"));
      if (!(score >= 1 && score <= 5)) return fail("Vui lòng chấm điểm chất lượng từ 1 đến 5.");
      await db.task.update({ where: { id }, data: { status: "DONE", completedAt: task.submittedAt ?? new Date(), qualityScore: score, reviewNote: note || null } });
      refresh(id);
      return ok("Đã nghiệm thu công việc.");
    }
    if (intent === "revise" && isAssigner && task.status === "SUBMITTED") {
      if (!note) return fail("Vui lòng ghi rõ nội dung cần chỉnh sửa.");
      // Yêu cầu sửa = chưa hoàn thành: xóa mốc nộp, tiến độ sẽ tính theo lần nộp lại
      await db.task.update({ where: { id }, data: { status: "REVISION", submittedAt: null, reviewNote: note } });
      await db.taskComment.create({ data: { taskId: id, userId: user.id, content: `[Yêu cầu chỉnh sửa] ${note}` } });
      refresh(id);
      return ok("Đã yêu cầu chỉnh sửa.");
    }
    return fail("Thao tác không hợp lệ với trạng thái hiện tại.");
  });
}

export async function addComment(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireUser();
    const taskId = str(fd, "taskId");
    const content = str(fd, "content");
    if (!content) return fail("Nội dung trống.");
    const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
    if (![task.assigneeId, task.assignerId].includes(user.id) && !["ADMIN", "HEAD"].includes(user.role)) return fail("Bạn không tham gia công việc này.");
    await db.taskComment.create({ data: { taskId, userId: user.id, content } });
    refresh(taskId);
    return ok("Đã gửi trao đổi.");
  });
}

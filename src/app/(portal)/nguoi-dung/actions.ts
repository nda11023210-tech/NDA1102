"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { ROLES, type Role } from "@/lib/constants";
import { str } from "@/lib/utils";

/** Quản trị viên sửa thông tin một tài khoản (không tự đổi vai trò của chính mình) */
export async function updateUserInfo(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const admin = await requireRole("ADMIN");
    const id = str(fd, "id");
    const name = str(fd, "name");
    const email = str(fd, "email").toLowerCase();
    const role = str(fd, "role") as Role;
    if (!name || !email) return fail("Vui lòng nhập họ tên và email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Email không hợp lệ.");
    if (!ROLES.includes(role)) return fail("Vai trò không hợp lệ.");
    const dup = await db.user.findUnique({ where: { email } });
    if (dup && dup.id !== id) return fail("Email đã được dùng cho tài khoản khác.");
    await db.user.update({
      where: { id },
      data: {
        name,
        email,
        title: str(fd, "title") || null,
        phone: str(fd, "phone") || null,
        expertise: str(fd, "expertise") || null,
        ...(id !== admin.id ? { role } : {}),
      },
    });
    revalidatePath("/nguoi-dung", "layout");
    return ok(id === admin.id && role !== admin.role ? "Đã lưu. Bạn không thể tự đổi vai trò của chính mình." : "Đã lưu thông tin tài khoản.");
  });
}

/**
 * Xóa tài khoản. Chỉ cho xóa khi tài khoản CHƯA phát sinh dữ liệu nghiệp vụ (văn bản, minh chứng,
 * lịch sử duyệt, công việc, mượn thiết bị…) để không làm mất/hỏng lịch sử. Tài khoản đã có dữ liệu → dùng Khóa.
 */
export async function deleteUser(_: ActionState, fd: FormData): Promise<ActionState> {
  let deleted = false;
  const res = await attempt(async () => {
    const admin = await requireRole("ADMIN");
    const id = str(fd, "id");
    if (id === admin.id) return fail("Không thể tự xóa tài khoản của chính mình.");
    const u = await db.user.findUniqueOrThrow({
      where: { id },
      include: {
        _count: {
          select: {
            documentsCreated: true,
            attachments: true,
            loans: true,
            loansApproved: true,
            inventoryChecks: true,
            inventoryItems: true,
            campaigns: true,
            evidences: true,
            evidenceLogs: true,
            assignments: true,
            tasksAssigned: true,
            tasksCreated: true,
            taskComments: true,
            kbArticles: true,
          },
        },
      },
    });
    const c = u._count;
    const linked = [
      [c.documentsCreated, "văn bản đã đăng"],
      [c.evidences, "minh chứng đã nộp"],
      [c.evidenceLogs, "lượt nộp/duyệt minh chứng"],
      [c.campaigns, "đợt minh chứng đã tạo"],
      [c.tasksAssigned, "công việc được giao"],
      [c.tasksCreated, "công việc đã giao"],
      [c.taskComments, "trao đổi công việc"],
      [c.loans + c.loansApproved, "lượt mượn/duyệt mượn thiết bị"],
      [c.inventoryChecks + c.inventoryItems, "lượt kiểm kê"],
      [c.assignments, "phân công giảng dạy"],
      [c.kbArticles, "bài viết kho tri thức"],
      [c.attachments, "tệp đã tải lên"],
    ].filter(([n]) => (n as number) > 0);
    if (linked.length) {
      return fail(
        `Tài khoản đã có dữ liệu: ${linked.map(([n, t]) => `${n} ${t}`).join(", ")}. Để giữ nguyên lịch sử, hãy dùng “Khóa” thay vì xóa.`,
      );
    }
    await db.user.delete({ where: { id } }); // xóa kèm đăng ký môn, lịch sử chat, dữ liệu đã đọc văn bản
    revalidatePath("/nguoi-dung", "layout");
    deleted = str(fd, "from") === "detail";
    return ok(`Đã xóa tài khoản ${u.name}.`);
  });
  if (res?.ok && deleted) redirect("/nguoi-dung");
  return res;
}

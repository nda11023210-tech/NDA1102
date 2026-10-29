import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { normalizeRole, type Role } from "./constants";
import { SESSION_COOKIE, verifySession } from "./session";

/** Người dùng hiện tại (đọc lại từ CSDL để vai trò/trạng thái luôn mới nhất) */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true, role: true, title: true, active: true },
  });
  if (!user || !user.active) return null;
  return { ...user, role: normalizeRole(user.role) };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Bắt buộc có một trong các vai trò; ADMIN luôn được phép */
export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !roles.includes(user.role)) redirect("/khong-co-quyen");
  return user;
}

export function hasRole(user: { role: Role }, ...roles: Role[]) {
  return user.role === "ADMIN" || roles.includes(user.role);
}

/** Chỉ Quản trị viên được SỬA và XÓA dữ liệu trên toàn hệ thống */
export const isAdmin = (user: { role: Role }) => user.role === "ADMIN";

/** Quản lý khoa (hoặc Quản trị viên) */
export const isManager = (user: { role: Role }) => hasRole(user, "MANAGER");

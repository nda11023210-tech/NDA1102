"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fail, type ActionState } from "@/lib/action-state";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import type { Role } from "@/lib/constants";
import { str } from "@/lib/utils";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const next = str(fd, "next");
  if (!email || !password) return fail("Vui lòng nhập email và mật khẩu.");

  const user = await db.user.findUnique({ where: { email } });
  // So sánh băm kể cả khi không có user để tránh lộ thông tin qua thời gian phản hồi
  const valid = await bcrypt.compare(password, user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !valid) return fail("Email hoặc mật khẩu không đúng.");
  if (!user.active) return fail("Tài khoản đã bị khóa. Vui lòng liên hệ Quản trị viên.");

  const token = await signSession({ sub: user.id, name: user.name, role: user.role as Role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

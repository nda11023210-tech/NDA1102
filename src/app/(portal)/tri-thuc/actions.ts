"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { str } from "@/lib/utils";

export async function saveArticle(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = str(fd, "id");
  const res = await attempt(async () => {
    const user = await requireRole("MANAGER");
    if (id && user.role !== "ADMIN") return fail("Chỉ Quản trị viên được sửa bài viết đã đăng.");
    const title = str(fd, "title");
    const category = str(fd, "category");
    const content = str(fd, "content");
    if (!title || !category || content.length < 20) return fail("Vui lòng nhập tiêu đề, chủ đề và nội dung (tối thiểu 20 ký tự).");
    const data = { title, category, content, tags: str(fd, "tags") || null };
    if (id) await db.kbArticle.update({ where: { id }, data });
    else id = (await db.kbArticle.create({ data: { ...data, createdById: user.id } })).id;
    return ok("Đã lưu bài viết.");
  });
  if (res?.ok) {
    revalidatePath("/tri-thuc", "layout");
    redirect(`/tri-thuc/${id}`);
  }
  return res;
}

export async function deleteArticle(fd: FormData) {
  await requireRole("ADMIN");
  await db.kbArticle.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/tri-thuc", "layout");
  redirect("/tri-thuc");
}

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { saveUploads, deleteUpload } from "@/lib/uploads";
import { fromLocalInput, normalizeVi, str } from "@/lib/utils";

export async function createDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await attempt(async () => {
    const user = await requireRole("MANAGER");
    const title = str(fd, "title");
    const categoryId = str(fd, "categoryId");
    if (!title || !categoryId) return fail("Vui lòng nhập tiêu đề và chọn danh mục.");
    const requireSign = fd.get("requireSign") === "on";
    const doc = await db.document.create({
      data: {
        title,
        categoryId,
        number: str(fd, "number") || null,
        summary: str(fd, "summary") || null,
        content: str(fd, "content") || null,
        issuedAt: fromLocalInput(str(fd, "issuedAt")) ?? new Date(),
        requireSign,
        signDueAt: requireSign ? fromLocalInput(str(fd, "signDueAt")) : null,
        createdById: user.id,
      },
    });
    await saveUploads(fd, user.id, { documentId: doc.id });
    id = doc.id;
    return ok("Đã đăng văn bản.");
  });
  if (res?.ok) {
    revalidatePath("/van-ban");
    redirect(`/van-ban/${id}`);
  }
  return res;
}

export async function signDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireUser();
    const documentId = str(fd, "documentId");
    const signature = str(fd, "signature");
    // Ký nhận bằng cách gõ lại đúng họ tên (không phân biệt dấu/hoa thường)
    if (normalizeVi(signature).replace(/\s+/g, " ") !== normalizeVi(user.name).replace(/\s+/g, " ")) {
      return fail(`Họ tên xác nhận chưa khớp. Vui lòng gõ chính xác: “${user.name}”.`);
    }
    if (fd.get("agree") !== "on") return fail("Vui lòng tích xác nhận đã đọc và nắm rõ nội dung văn bản.");
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const now = new Date();
    await db.documentReceipt.upsert({
      where: { documentId_userId: { documentId, userId: user.id } },
      create: { documentId, userId: user.id, readAt: now, signedAt: now, signatureName: user.name, signatureIp: ip },
      update: { signedAt: now, signatureName: user.name, signatureIp: ip },
    });
    revalidatePath(`/van-ban/${documentId}`);
    revalidatePath("/van-ban");
    return ok("Đã ký nhận văn bản điện tử.");
  });
}

export async function deleteDocument(fd: FormData) {
  await requireRole("MANAGER");
  const id = str(fd, "id");
  const files = await db.attachment.findMany({ where: { documentId: id } });
  await db.document.delete({ where: { id } });
  await Promise.all(files.map((f) => deleteUpload(f.storedName)));
  revalidatePath("/van-ban");
  redirect("/van-ban");
}

export async function createCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const name = str(fd, "name");
    if (!name) return fail("Vui lòng nhập tên danh mục.");
    const slug = normalizeVi(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (await db.docCategory.findUnique({ where: { slug } })) return fail("Danh mục đã tồn tại.");
    await db.docCategory.create({ data: { name, slug, color: str(fd, "color") || "blue" } });
    revalidatePath("/van-ban");
    return ok(`Đã thêm danh mục “${name}”.`);
  });
}

/**
 * Sửa văn bản: nội dung, danh mục, yêu cầu ký nhận; thêm tệp mới và gỡ tệp cũ.
 * Nếu tích "Yêu cầu ký nhận lại", mọi chữ ký cũ bị hủy (giữ trạng thái đã đọc) để mọi người ký bản mới.
 */
export async function updateDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await attempt(async () => {
    const user = await requireRole("MANAGER");
    id = str(fd, "id");
    const title = str(fd, "title");
    const categoryId = str(fd, "categoryId");
    if (!title || !categoryId) return fail("Vui lòng nhập tiêu đề và chọn danh mục.");
    const requireSign = fd.get("requireSign") === "on";
    await db.document.update({
      where: { id },
      data: {
        title,
        categoryId,
        number: str(fd, "number") || null,
        summary: str(fd, "summary") || null,
        content: str(fd, "content") || null,
        issuedAt: fromLocalInput(str(fd, "issuedAt")) ?? undefined,
        requireSign,
        signDueAt: requireSign ? fromLocalInput(str(fd, "signDueAt")) : null,
      },
    });
    // Gỡ tệp được chọn
    const removeIds = fd.getAll("removeAttachment").map(String);
    if (removeIds.length) {
      const files = await db.attachment.findMany({ where: { id: { in: removeIds }, documentId: id } });
      await db.attachment.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
      await Promise.all(files.map((f) => deleteUpload(f.storedName)));
    }
    await saveUploads(fd, user.id, { documentId: id });
    if (fd.get("resetSignatures") === "on") {
      await db.documentReceipt.updateMany({ where: { documentId: id }, data: { signedAt: null, signatureName: null, signatureIp: null } });
    }
    return ok("Đã cập nhật văn bản.");
  });
  if (res?.ok) {
    revalidatePath("/van-ban");
    revalidatePath(`/van-ban/${id}`);
    redirect(`/van-ban/${id}`);
  }
  return res;
}

/** Xóa văn bản (dùng cho nút xóa có hiển thị lỗi) */
export async function deleteDocumentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await attempt(async () => {
    await requireRole("MANAGER");
    const id = str(fd, "id");
    const files = await db.attachment.findMany({ where: { documentId: id } });
    const d = await db.document.delete({ where: { id } });
    await Promise.all(files.map((f) => deleteUpload(f.storedName)));
    revalidatePath("/van-ban");
    return ok(`Đã xóa văn bản “${d.title}”.`);
  });
  if (res?.ok && str(fd, "from") === "detail") redirect("/van-ban");
  return res;
}

export async function updateCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const id = str(fd, "id");
    const name = str(fd, "name");
    if (!name) return fail("Vui lòng nhập tên danh mục.");
    await db.docCategory.update({ where: { id }, data: { name, color: str(fd, "color") || "blue" } });
    revalidatePath("/van-ban");
    return ok("Đã lưu danh mục.");
  });
}

export async function deleteCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const id = str(fd, "id");
    const n = await db.document.count({ where: { categoryId: id } });
    if (n) return fail(`Danh mục đang có ${n} văn bản – hãy chuyển hoặc xóa các văn bản đó trước.`);
    await db.docCategory.delete({ where: { id } });
    revalidatePath("/van-ban");
    return ok("Đã xóa danh mục.");
  });
}

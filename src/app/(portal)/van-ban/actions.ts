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
    const user = await requireRole("HEAD", "ASSISTANT");
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
  await requireRole("HEAD", "ASSISTANT");
  const id = str(fd, "id");
  const files = await db.attachment.findMany({ where: { documentId: id } });
  await db.document.delete({ where: { id } });
  await Promise.all(files.map((f) => deleteUpload(f.storedName)));
  revalidatePath("/van-ban");
  redirect("/van-ban");
}

export async function createCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("HEAD", "ASSISTANT");
    const name = str(fd, "name");
    if (!name) return fail("Vui lòng nhập tên danh mục.");
    const slug = normalizeVi(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (await db.docCategory.findUnique({ where: { slug } })) return fail("Danh mục đã tồn tại.");
    await db.docCategory.create({ data: { name, slug, color: str(fd, "color") || "blue" } });
    revalidatePath("/van-ban");
    return ok(`Đã thêm danh mục “${name}”.`);
  });
}

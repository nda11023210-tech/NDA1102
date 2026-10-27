import "server-only";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { db } from "./db";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv",
  ".png", ".jpg", ".jpeg", ".webp", ".zip", ".rar", ".7z",
]);

export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");
}

type Owner = { documentId?: string; evidenceId?: string; taskId?: string };

/** Lưu các tệp từ FormData (trường `files`) và tạo bản ghi Attachment */
export async function saveUploads(fd: FormData, uploadedById: string, owner: Owner) {
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return [];
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const saved = [];
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) throw new Error(`Định dạng tệp không được hỗ trợ: ${file.name}`);
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`Tệp vượt quá 20MB: ${file.name}`);
    const storedName = `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
    await writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));
    saved.push(
      await db.attachment.create({
        data: {
          fileName: file.name,
          storedName,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          uploadedById,
          ...owner,
        },
      }),
    );
  }
  return saved;
}

export async function readUpload(storedName: string) {
  // storedName do hệ thống sinh, nhưng vẫn chặn path traversal
  const safe = path.basename(storedName);
  return readFile(path.join(uploadDir(), safe));
}

export async function deleteUpload(storedName: string) {
  await unlink(path.join(uploadDir(), path.basename(storedName))).catch(() => {});
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/uploads";

// Tải tệp đính kèm – chỉ người đã đăng nhập (mọi tệp trong cổng là nội bộ Khoa)
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const file = await db.attachment.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Không tìm thấy tệp" }, { status: 404 });

  try {
    const data = await readUpload(file.storedName);
    const inline = file.mimeType.startsWith("image/") || file.mimeType === "application/pdf";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Tệp không còn trên máy chủ" }, { status: 410 });
  }
}

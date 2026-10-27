// Chuyển dữ liệu sau khi gộp vai trò Trưởng khoa + Trợ lý khoa thành "Quản lý khoa" (MANAGER).
// Chạy một lần trên CSDL đang dùng:  npx tsx scripts/migrate-roles.ts
// An toàn khi chạy lại nhiều lần. Không sửa lịch sử duyệt minh chứng (giữ nguyên để tra cứu).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const users = await db.user.updateMany({ where: { role: { in: ["HEAD", "ASSISTANT"] } }, data: { role: "MANAGER" } });
  // Hồ sơ đã qua cấp 1 của quy trình cũ: đưa về "chờ duyệt" để Quản lý khoa phê duyệt một lần
  const evidences = await db.evidence.updateMany({ where: { status: "ASSISTANT_APPROVED" }, data: { status: "SUBMITTED" } });
  console.log(`✔ Đã chuyển ${users.count} tài khoản sang Quản lý khoa, ${evidences.count} minh chứng về trạng thái chờ duyệt.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

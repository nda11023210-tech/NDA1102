// Chạy thử trên máy không có MySQL: sinh schema SQLite từ prisma/schema.prisma,
// tạo CSDL prisma/local/dev.db, sinh Prisma Client cho SQLite và nạp dữ liệu mẫu.
// Lưu ý: sau đó `npm run build` (bản production) sẽ sinh lại client cho MySQL.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const src = readFileSync("prisma/schema.prisma", "utf8");
const sqlite = src
  .replace('provider = "mysql"', 'provider = "sqlite"')
  .replace('url      = env("DATABASE_URL")', 'url      = "file:./dev.db"')
  .replace(/\s@db\.\w+(\([^)]*\))?/g, "");

mkdirSync("prisma/local", { recursive: true });
writeFileSync("prisma/local/schema.prisma", sqlite);

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
// Không dùng --force-reset: lần đầu tạo mới, các lần sau chỉ đồng bộ schema (seed tự bỏ qua nếu đã có dữ liệu)
run("npx prisma db push --skip-generate --schema prisma/local/schema.prisma");
run("npx prisma generate --schema prisma/local/schema.prisma");
run("npx tsx prisma/seed.ts");
console.log("\n✔ CSDL SQLite local đã sẵn sàng: prisma/local/dev.db");

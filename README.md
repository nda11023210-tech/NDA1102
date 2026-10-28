# Cổng quản trị Khoa CNTT – Trường Cao đẳng Công nghiệp Bắc Ninh

Hệ thống quản trị nội bộ dành cho cán bộ, giảng viên Khoa Công nghệ Thông tin.
Xây dựng bằng **Next.js 15 (Node.js) + Tailwind CSS 4 + Prisma + MySQL**, tích hợp **Claude AI**.

## Chức năng

| Module | Nội dung |
|---|---|
| **1. Văn bản & Thông báo** | Đăng văn bản theo danh mục (Công văn, Thông báo, Quyết định…), đính kèm tệp, ký nhận điện tử (gõ họ tên + lưu thời gian, IP), theo dõi tỷ lệ đã đọc/đã ký của từng người. |
| **2. Trang thiết bị** | Danh mục thiết bị (thêm, sửa, xóa), trạng thái sử dụng, đăng ký mượn – duyệt – trả, in tem QR, kiểm kê định kỳ bằng cách quét QR (camera điện thoại hoặc trình quét trong trang). |
| **3. Minh chứng Sở ban ngành** | Tạo đợt minh chứng theo tiêu chí, giảng viên nộp kèm tệp, Quản lý khoa phê duyệt một lần (ghi tên người duyệt, lịch sử không thể sửa), trả hồ sơ/nộp lại, xuất báo cáo Excel (CSV). |
| **4. Thời khóa biểu thông minh** | Giảng viên tự đăng ký môn có thể dạy; Quản lý khoa nhập kế hoạch giảng dạy của lớp. Thuật toán 2 giai đoạn: (1) phân bổ giảng viên – ưu tiên môn đã đăng ký, chia đều tối đa 5 buổi/người (thiếu lớp/phòng thì chênh lệch ≤ 1 buổi); (2) xếp lịch tuần CSP – không trùng GV/lớp/phòng, MĐ 6 giờ ở phòng thực hành, MH 5 giờ ở phòng lý thuyết, ưu tiên mỗi GV dạy trọn buổi sáng hoặc trọn buổi chiều. Chỉnh tay kéo-thả, khóa buổi, công bố/hủy công bố, hiển thị đủ mã môn – lớp – phòng. |
| **5. Giao việc & Hiệu suất** | Giao việc có hạn chót, tiêu chí nghiệm thu, khối lượng; nộp kết quả, nghiệm thu chấm sao. Chấm điểm tự động: Tiến độ 40% · Khối lượng 30% · Chất lượng 30%, biểu đồ, nhận xét do AI viết. |
| **6. Trợ lý AI & Kho tri thức** | Kho quy chế/quy trình; chatbot tra cứu 24/7 (RAG: tìm kiếm BM25 không dấu → Claude trả lời kèm nguồn). Không có API key vẫn chạy ở chế độ tra cứu nhanh. |

**Vai trò:** Quản trị viên · Quản lý khoa · Giảng viên.

## Chạy thử trên máy (không cần MySQL)

Yêu cầu: Node.js ≥ 20.9.

```bash
npm install
```

```bash
npm run local:sqlite
```

Lệnh trên tạo CSDL SQLite tạm tại `prisma/local/dev.db`, nạp dữ liệu mẫu. Sau đó:

```bash
npm run dev
```

Mở http://localhost:3000 và đăng nhập (mật khẩu mặc định `Kcntt@2026`):

| Vai trò | Email |
|---|---|
| Quản trị viên | admin@cntt.bnic.edu.vn |
| Quản lý khoa | truongkhoa@cntt.bnic.edu.vn, troly1@cntt.bnic.edu.vn, troly2@cntt.bnic.edu.vn |
| Giảng viên | gv.anh@cntt.bnic.edu.vn |

> ⚠️ Dữ liệu mẫu (tên người, văn bản, quy chế) là **giả lập**. Hãy đổi mật khẩu/xóa tài khoản mẫu và thay nội dung thật trước khi dùng chính thức.

> Lưu ý: `npm run build` sinh lại Prisma Client cho MySQL. Nếu muốn quay lại chạy thử bằng SQLite sau đó, chạy lại `npm run local:sqlite`.

Tài liệu giải thích chi tiết mã nguồn và cơ chế hoạt động: `docs/Giai-thich-ma-nguon.docx`.

Kiểm thử thuật toán xếp thời khóa biểu:

```bash
npm run test:solver
```

## Triển khai lên Hostinger (gói Business/Cloud – Node.js Apps)

### 1. Đẩy mã nguồn lên GitHub

```bash
git remote add origin https://github.com/<tai-khoan>/<ten-repo>.git
```

```bash
git push -u origin main
```

### 2. Tạo cơ sở dữ liệu MySQL

hPanel → **Databases → MySQL Databases** → tạo database + user. Ghi lại tên DB, user, mật khẩu.
Chuỗi kết nối có dạng: `mysql://USER:MATKHAU@localhost:3306/TEN_DB` (mật khẩu có ký tự đặc biệt cần mã hóa URL, ví dụ `@` → `%40`).

### 3. Tạo ứng dụng Node.js

hPanel → **Websites → Add Website → Node.js Apps** (hoặc **Advanced → Node.js**) → **Import Git Repository** → chọn repo.

| Thiết lập | Giá trị |
|---|---|
| Framework | Next.js |
| Node version | 20.x hoặc 22.x |
| Build command | `npm run build:prod` |
| Start command | `npm start` |
| Entry / output | để mặc định |

**Biến môi trường** (Environment variables):

| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | chuỗi MySQL ở bước 2 |
| `AUTH_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự (tạo bằng `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`) |
| `UPLOAD_DIR` | thư mục **ngoài** mã nguồn, ví dụ `/home/u123456789/kcntt-uploads` (để tệp không mất khi deploy lại) |
| `ANTHROPIC_API_KEY` | khóa Claude API (bỏ trống nếu chưa dùng AI) |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` |
| `APP_URL` | tên miền chính thức, ví dụ `https://cntt.bnic.edu.vn` (dùng cho mã QR) |
| `SEED_PASSWORD` | mật khẩu tài khoản mẫu khi chạy seed lần đầu |

`build:prod` tự tạo/cập nhật bảng trong MySQL (`prisma db push`) rồi build.

### 4. Nạp dữ liệu ban đầu (chỉ một lần)

Qua SSH (hPanel → Advanced → SSH Access), trong thư mục ứng dụng:

```bash
npm run db:seed
```

Seed tự bỏ qua nếu CSDL đã có dữ liệu. Muốn bắt đầu với CSDL trống thật sự: chỉ tạo tài khoản admin rồi xóa dữ liệu mẫu trên giao diện, hoặc chỉnh `prisma/seed.ts`.

### 5. Tên miền & HTTPS

Gắn tên miền cho ứng dụng trong hPanel và bật SSL miễn phí. Cookie đăng nhập dùng cờ `secure` ở môi trường production nên **bắt buộc HTTPS**.

### Cập nhật về sau

Mỗi lần `git push` lên nhánh đã kết nối, Hostinger tự build và khởi động lại (nếu bật auto-deploy), hoặc bấm **Redeploy** trong hPanel.

## Nâng cấp CSDL đã có dữ liệu

Khi cập nhật lên phiên bản mới, sau bước build (đã tự `prisma db push` thêm bảng/cột mới), chạy một lần (qua SSH trên Hostinger, hoặc trên máy):

```bash
npx tsx scripts/migrate-data.ts
```

Lệnh an toàn khi chạy lại nhiều lần:
- chuyển tài khoản Trưởng khoa/Trợ lý khoa (bản cũ) thành Quản lý khoa;
- tách bộ phân công riêng cho từng phiên bản thời khóa biểu;
- nếu chưa có, tạo Kế hoạch giảng dạy của lớp và Đăng ký môn dạy từ thời khóa biểu hiện có.

## Thay logo & màu nhận diện

- Logo: thay `public/logo.png` và `src/app/icon.png` (favicon).
- Màu: sửa các biến `--brand-*` và `--action` ở đầu `src/app/globals.css`.
- Tên Khoa/Trường: `src/lib/constants.ts`.

## Cấu trúc

```
prisma/schema.prisma        Mô hình dữ liệu (MySQL)
prisma/seed.ts              Dữ liệu mẫu
src/lib/scheduler.ts        Thuật toán xếp thời khóa biểu (phân bổ giảng viên + CSP)
src/lib/performance.ts      Chấm điểm hiệu suất theo trọng số
src/lib/kb-search.ts        Tìm kiếm kho tri thức (BM25, không dấu)
src/lib/ai.ts               Kết nối Claude API
src/app/(portal)/...        Các trang chức năng
src/app/api/chat            API chatbot (streaming)
```

## Bảo mật

- Mật khẩu băm bcrypt; phiên đăng nhập JWT ký HS256 trong cookie httpOnly, 12 giờ.
- Phân quyền kiểm tra ở phía máy chủ cho mọi thao tác (server actions).
- Tệp tải lên lưu ngoài thư mục public, chỉ tải được khi đã đăng nhập; giới hạn 20MB và danh sách đuôi tệp cho phép.
- Toàn bộ site đặt `noindex`, không cho công cụ tìm kiếm lập chỉ mục.

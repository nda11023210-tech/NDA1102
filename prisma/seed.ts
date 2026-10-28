/**
 * Dữ liệu mẫu cho Cổng quản trị Khoa CNTT.
 * Chạy: npm run db:seed            (chỉ chạy khi CSDL đang trống)
 *       npm run db:seed -- --force (XÓA toàn bộ dữ liệu cũ rồi nạp lại)
 *
 * Toàn bộ tên người, văn bản, quy định dưới đây là DỮ LIỆU GIẢ LẬP để chạy thử,
 * cần thay bằng dữ liệu thật của Khoa trước khi đưa vào sử dụng.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { planTimetable, type Kind, type RoomType } from "../src/lib/scheduler";

const db = new PrismaClient();
const DAY = 86_400_000;
const now = Date.now();
const daysFromNow = (d: number, hour = 17) => {
  const t = new Date(now + d * DAY);
  t.setHours(hour, 0, 0, 0);
  return t;
};

let seed = 20261027;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");
async function sampleFile(name: string, body: string, uploadedById: string, owner: { documentId?: string; evidenceId?: string; taskId?: string }) {
  await mkdir(uploadDir, { recursive: true });
  const storedName = `${Date.now()}-${randomBytes(6).toString("hex")}.txt`;
  const content = `${body}\n\n(Tệp mẫu do hệ thống tạo để chạy thử)`;
  await writeFile(path.join(uploadDir, storedName), content, "utf8");
  return db.attachment.create({
    data: { fileName: name.endsWith(".txt") ? name : `${name}.txt`, storedName, mimeType: "text/plain", size: Buffer.byteLength(content), uploadedById, ...owner },
  });
}

async function wipe() {
  // Thứ tự xóa theo quan hệ khóa ngoại
  await db.chatLog.deleteMany();
  await db.performanceReview.deleteMany();
  await db.taskComment.deleteMany();
  await db.attachment.deleteMany();
  await db.task.deleteMany();
  await db.timetableEntry.deleteMany();
  await db.timetable.deleteMany();
  await db.teachingAssignment.deleteMany();
  await db.subject.deleteMany();
  await db.classGroup.deleteMany();
  await db.room.deleteMany();
  await db.evidenceLog.deleteMany();
  await db.evidence.deleteMany();
  await db.evidenceCriterion.deleteMany();
  await db.evidenceCampaign.deleteMany();
  await db.inventoryItem.deleteMany();
  await db.inventoryCheck.deleteMany();
  await db.assetLoan.deleteMany();
  await db.asset.deleteMany();
  await db.documentReceipt.deleteMany();
  await db.document.deleteMany();
  await db.docCategory.deleteMany();
  await db.kbArticle.deleteMany();
  await db.user.deleteMany();
}

async function main() {
  const force = process.argv.includes("--force");
  if ((await db.user.count()) > 0 && !force) {
    console.log("CSDL đã có dữ liệu – bỏ qua seed. Dùng `npm run db:seed -- --force` để xóa và nạp lại.");
    return;
  }
  if (force) await wipe();

  const password = await bcrypt.hash(process.env.SEED_PASSWORD || "Kcntt@2026", 10);
  const mk = (email: string, name: string, role: string, title: string, expertise?: string) =>
    db.user.create({ data: { email, name, role, title, expertise, passwordHash: password } });

  // ───────── Người dùng ─────────
  const admin = await mk("admin@cntt.bnic.edu.vn", "Quản trị Hệ thống", "ADMIN", "KS.");
  const head = await mk("truongkhoa@cntt.bnic.edu.vn", "Nguyễn Văn Hùng", "MANAGER", "TS.", "Hệ thống thông tin");
  const asst1 = await mk("troly1@cntt.bnic.edu.vn", "Trần Thị Thu Hà", "MANAGER", "ThS.", "Quản lý đào tạo");
  const asst2 = await mk("troly2@cntt.bnic.edu.vn", "Lê Minh Đức", "MANAGER", "ThS.", "Quản trị thiết bị");
  const lecturerSpecs: [string, string, string][] = [
    ["gv.anh@cntt.bnic.edu.vn", "Phạm Quốc Anh", "Lập trình"],
    ["gv.binh@cntt.bnic.edu.vn", "Đỗ Thanh Bình", "Mạng máy tính"],
    ["gv.chi@cntt.bnic.edu.vn", "Nguyễn Thị Kim Chi", "Cơ sở dữ liệu"],
    ["gv.dung@cntt.bnic.edu.vn", "Vũ Tiến Dũng", "Phần cứng"],
    ["gv.giang@cntt.bnic.edu.vn", "Hoàng Thu Giang", "Thiết kế đồ họa"],
    ["gv.hai@cntt.bnic.edu.vn", "Ngô Văn Hải", "Lập trình Web"],
    ["gv.hoa@cntt.bnic.edu.vn", "Bùi Thị Hòa", "Phân tích hệ thống"],
    ["gv.khanh@cntt.bnic.edu.vn", "Đặng Quang Khánh", "An toàn thông tin"],
    ["gv.lan@cntt.bnic.edu.vn", "Trịnh Ngọc Lan", "Lập trình di động"],
    ["gv.minh@cntt.bnic.edu.vn", "Lý Đức Minh", "Quản trị mạng"],
    ["gv.ngoc@cntt.bnic.edu.vn", "Phan Bảo Ngọc", "Cấu trúc dữ liệu"],
    ["gv.son@cntt.bnic.edu.vn", "Cao Hoàng Sơn", "Kiến trúc máy tính"],
  ];
  const lecturers = [];
  for (const [email, name, exp] of lecturerSpecs) lecturers.push(await mk(email, name, "LECTURER", pick(["ThS.", "ThS.", "KS.", "CN."]), exp));
  const staff = [head, asst1, asst2, ...lecturers];

  // ───────── Module 1: Văn bản ─────────
  const cats = {
    cv: await db.docCategory.create({ data: { name: "Công văn", slug: "cong-van", color: "blue" } }),
    tb: await db.docCategory.create({ data: { name: "Thông báo", slug: "thong-bao", color: "green" } }),
    qd: await db.docCategory.create({ data: { name: "Quyết định", slug: "quyet-dinh", color: "red" } }),
    kh: await db.docCategory.create({ data: { name: "Kế hoạch", slug: "ke-hoach", color: "violet" } }),
    bm: await db.docCategory.create({ data: { name: "Biểu mẫu", slug: "bieu-mau", color: "slate" } }),
  };
  const docs: { cat: keyof typeof cats; number: string; title: string; summary: string; content: string; sign: boolean; issued: number; due?: number }[] = [
    {
      cat: "tb",
      number: "142/TB-KCNTT",
      title: "Thông báo lịch họp Khoa định kỳ tháng 11/2026",
      summary: "Họp toàn thể cán bộ, giảng viên vào 14h00 thứ Sáu tuần đầu tiên của tháng 11 tại phòng A1.301.",
      content:
        "Kính gửi: Toàn thể cán bộ, giảng viên Khoa CNTT.\n\nKhoa tổ chức họp định kỳ tháng 11/2026:\n- Thời gian: 14h00, thứ Sáu tuần đầu tiên của tháng 11/2026.\n- Địa điểm: Phòng họp A1.301.\n- Nội dung: Sơ kết công tác tháng 10; triển khai kế hoạch kiểm định chất lượng; phân công coi thi giữa kỳ.\n\nĐề nghị các thầy/cô sắp xếp công việc tham dự đầy đủ, đúng giờ.",
      sign: true,
      issued: -2,
      due: 3,
    },
    {
      cat: "kh",
      number: "38/KH-KCNTT",
      title: "Kế hoạch kiểm định chất lượng chương trình đào tạo ngành CNTT năm 2026",
      summary: "Triển khai thu thập minh chứng theo bộ tiêu chí kiểm định, hoàn thành trước 30/11/2026.",
      content:
        "Căn cứ hướng dẫn của Sở về kiểm định chất lượng chương trình đào tạo trình độ cao đẳng, Khoa xây dựng kế hoạch như sau:\n\n1. Thành lập tổ tự đánh giá do Trưởng khoa làm tổ trưởng.\n2. Giảng viên nộp minh chứng theo tiêu chí trên Cổng quản trị (mục Minh chứng Sở ban ngành).\n3. Quản lý khoa rà soát và phê duyệt minh chứng trên hệ thống.\n4. Hạn hoàn thành: 30/11/2026.",
      sign: true,
      issued: -10,
      due: -3,
    },
    {
      cat: "qd",
      number: "215/QĐ-CĐCN",
      title: "Quyết định phân công giảng dạy học kỳ I năm học 2026–2027",
      summary: "Phân công giảng dạy cho giảng viên Khoa CNTT, áp dụng từ tuần 1 học kỳ I.",
      content: "Ban hành kèm theo Quyết định này danh sách phân công giảng dạy học kỳ I năm học 2026–2027 của Khoa Công nghệ Thông tin. Các thầy/cô xem chi tiết lịch dạy tại mục Thời khóa biểu trên Cổng quản trị.",
      sign: true,
      issued: -25,
      due: -18,
    },
    {
      cat: "cv",
      number: "1203/CV-CĐCN",
      title: "Công văn về việc cập nhật hồ sơ giảng dạy theo mẫu mới",
      summary: "Giảng viên cập nhật giáo án, đề cương chi tiết theo mẫu mới của Phòng Đào tạo.",
      content: "Phòng Đào tạo đề nghị các Khoa chỉ đạo giảng viên cập nhật hồ sơ giảng dạy (giáo án, đề cương chi tiết, sổ tay giáo viên) theo mẫu mới đính kèm. Thời hạn hoàn thành trước ngày 15/11/2026.",
      sign: false,
      issued: -6,
    },
    {
      cat: "tb",
      number: "139/TB-KCNTT",
      title: "Thông báo đăng ký đề tài nghiên cứu khoa học cấp trường năm 2027",
      summary: "Giảng viên đăng ký đề tài NCKH cấp trường, nộp thuyết minh trước 20/12/2026.",
      content: "Khoa thông báo tới giảng viên về việc đăng ký đề tài NCKH cấp trường năm 2027. Hồ sơ gồm: phiếu đăng ký, thuyết minh đề tài theo mẫu. Nộp bản mềm cho Quản lý khoa trước ngày 20/12/2026.",
      sign: false,
      issued: -14,
    },
    {
      cat: "bm",
      number: "BM-01",
      title: "Biểu mẫu đơn xin nghỉ phép, đổi giờ dạy",
      summary: "Mẫu đơn dùng chung cho cán bộ, giảng viên Khoa.",
      content: "Biểu mẫu dùng cho thủ tục xin nghỉ phép và đổi/bù giờ dạy. Xem hướng dẫn thủ tục chi tiết tại Kho tri thức.",
      sign: false,
      issued: -60,
    },
    {
      cat: "tb",
      number: "131/TB-KCNTT",
      title: "Thông báo kiểm kê tài sản, thiết bị cuối năm 2026",
      summary: "Khoa tiến hành kiểm kê toàn bộ thiết bị bằng mã QR từ ngày 01/12/2026.",
      content: "Đề nghị giảng viên phụ trách phòng thực hành phối hợp với Quản lý khoa kiểm tra, dán tem QR còn thiếu và báo cáo thiết bị hư hỏng trước khi kiểm kê.",
      sign: true,
      issued: -30,
      due: -22,
    },
  ];
  for (const d of docs) {
    const doc = await db.document.create({
      data: {
        number: d.number,
        title: d.title,
        summary: d.summary,
        content: d.content,
        categoryId: cats[d.cat].id,
        issuedAt: new Date(now + d.issued * DAY),
        requireSign: d.sign,
        signDueAt: d.due !== undefined ? daysFromNow(d.due) : null,
        createdById: pick([asst1, asst2, head]).id,
      },
    });
    await sampleFile(`${d.number.replace(/\//g, "-")}.txt`, `${d.title}\n\n${d.content}`, asst1.id, { documentId: doc.id });
    // Mức độ đọc/ký nhận giảm dần theo độ mới của văn bản
    const ratio = d.issued < -20 ? 0.95 : d.issued < -7 ? 0.7 : 0.35;
    for (const u of staff) {
      if (rand() > ratio) continue;
      const readAt = new Date(now + d.issued * DAY + rand() * Math.min(5, -d.issued) * DAY);
      const signed = d.sign && rand() < 0.9;
      await db.documentReceipt.create({
        data: {
          documentId: doc.id,
          userId: u.id,
          readAt,
          signedAt: signed ? new Date(readAt.getTime() + 3_600_000) : null,
          signatureName: signed ? u.name : null,
        },
      });
    }
  }

  // ───────── Module 2: Trang thiết bị ─────────
  const assetSpecs: [string, string, string, string, number][] = [
    ["LAB-A3201", "Phòng máy thực hành A3.201 (40 máy)", "LAB", "Tòa A3 – Tầng 2", 820_000_000],
    ["LAB-A3202", "Phòng máy thực hành A3.202 (40 máy)", "LAB", "Tòa A3 – Tầng 2", 790_000_000],
    ["LAB-A3203", "Phòng thực hành mạng A3.203", "LAB", "Tòa A3 – Tầng 2", 650_000_000],
    ["LAB-A3204", "Phòng thực hành phần cứng A3.204", "LAB", "Tòa A3 – Tầng 2", 480_000_000],
    ["LAB-A3205", "Phòng thực hành đồ họa A3.205", "LAB", "Tòa A3 – Tầng 2", 910_000_000],
  ];
  for (let i = 1; i <= 10; i++) assetSpecs.push([`MC-${String(i).padStart(3, "0")}`, `Máy chiếu ${pick(["Epson EB-X51", "Sony VPL-EX435", "ViewSonic PA503X"])}`, "PROJECTOR", i <= 5 ? `Phòng A2.10${i}` : "Kho Khoa – A1.105", 14_500_000]);
  for (let i = 1; i <= 6; i++) assetSpecs.push([`LT-${String(i).padStart(3, "0")}`, `Laptop giảng dạy ${pick(["Dell Latitude 5440", "HP ProBook 450 G10", "Lenovo ThinkPad E14"])}`, "COMPUTER", "Kho Khoa – A1.105", 19_800_000]);
  for (let i = 1; i <= 4; i++) assetSpecs.push([`SW-${String(i).padStart(3, "0")}`, `Switch Cisco Catalyst 2960 – 24 cổng`, "NETWORK", "Phòng A3.203", 12_000_000]);
  assetSpecs.push(["RT-001", "Bộ Router Cisco ISR 4321 (thực hành CCNA)", "NETWORK", "Phòng A3.203", 32_000_000]);
  for (let i = 1; i <= 4; i++) assetSpecs.push([`TB-${String(i).padStart(3, "0")}`, pick(["Bảng tương tác thông minh 75 inch", "Bộ kit Arduino thực hành (20 bộ)", "Camera hội nghị Logitech", "Loa trợ giảng không dây"]), "TEACHING", "Kho Khoa – A1.105", 8_500_000]);
  assetSpecs.push(["TB-005", "Máy in laser HP LaserJet M404dn", "OTHER", "Văn phòng Khoa – A1.104", 7_200_000]);
  const assets: Awaited<ReturnType<typeof db.asset.create>>[] = [];
  for (const [code, name, category, location, value] of assetSpecs) {
    assets.push(
      await db.asset.create({
        data: { code, name, category, location, value, serial: `SN${Math.floor(rand() * 1e8)}`, purchaseDate: new Date(now - (200 + rand() * 1500) * DAY) },
      }),
    );
  }
  const byCode = (c: string) => assets.find((a) => a.code === c)!;
  await db.asset.update({ where: { id: byCode("MC-004").id }, data: { status: "MAINTENANCE", note: "Bóng đèn yếu, đã báo bảo hành." } });
  await db.asset.update({ where: { id: byCode("SW-004").id }, data: { status: "BROKEN", note: "Hỏng 4 cổng, chờ thanh lý." } });

  const loan = (assetCode: string, borrower: { id: string }, purpose: string, start: number, hours: number, status: string, extra: object = {}) =>
    db.assetLoan.create({
      data: {
        assetId: byCode(assetCode).id,
        borrowerId: borrower.id,
        purpose,
        startAt: new Date(now + start * DAY),
        dueAt: new Date(now + start * DAY + hours * 3_600_000),
        status,
        approvedById: status === "PENDING" ? null : asst2.id,
        ...extra,
      },
    });
  for (let i = 0; i < 6; i++) {
    const s = -40 + i * 6;
    await loan(pick(["MC-006", "MC-007", "LT-001", "LT-002", "TB-003"]), pick(lecturers), "Dạy bù lớp ngoài giờ", s, 5, "RETURNED", { returnedAt: new Date(now + s * DAY + 5 * 3_600_000) });
  }
  await loan("LT-003", lecturers[0], "Hội thảo NCKH cấp trường", -2, 72, "APPROVED");
  await loan("MC-008", lecturers[5], "Dạy lớp CNTT-K25B tại hội trường", -4, 24, "APPROVED"); // quá hạn trả
  await db.asset.updateMany({ where: { code: { in: ["LT-003", "MC-008"] } }, data: { status: "BORROWED" } });
  await loan("MC-009", lecturers[2], "Báo cáo chuyên đề CSDL", 1, 4, "PENDING");
  await loan("TB-002", lecturers[3], "Hướng dẫn sinh viên làm đồ án IoT", 2, 48, "PENDING");
  await loan("LT-004", lecturers[8], "Coi thi trực tuyến", 3, 6, "PENDING");

  const oldCheck = await db.inventoryCheck.create({ data: { name: "Kiểm kê cuối năm 2025", startedAt: new Date(now - 300 * DAY), closedAt: new Date(now - 290 * DAY), createdById: asst2.id } });
  for (const a of assets) {
    await db.inventoryItem.create({
      data: { checkId: oldCheck.id, assetId: a.id, checkedById: asst2.id, condition: a.code === "SW-004" ? "DAMAGED" : "GOOD", checkedAt: new Date(now - 295 * DAY) },
    });
  }
  const openCheck = await db.inventoryCheck.create({ data: { name: "Kiểm kê giữa năm 2026", startedAt: new Date(now - 3 * DAY), createdById: asst2.id } });
  for (const a of assets.slice(0, 13)) {
    await db.inventoryItem.create({
      data: { checkId: openCheck.id, assetId: a.id, checkedById: asst2.id, condition: a.code === "MC-004" ? "DAMAGED" : "GOOD", note: a.code === "MC-004" ? "Đang bảo hành" : null, checkedAt: new Date(now - rand() * 3 * DAY) },
    });
  }

  // ───────── Module 3: Minh chứng ─────────
  const camp1 = await db.evidenceCampaign.create({
    data: {
      title: "Kiểm định chất lượng CTĐT ngành Công nghệ thông tin 2026",
      agency: "Sở Giáo dục và Đào tạo tỉnh Bắc Ninh",
      description: "Thu thập minh chứng phục vụ tự đánh giá chương trình đào tạo trình độ cao đẳng.",
      openAt: new Date(now - 20 * DAY),
      closeAt: daysFromNow(34),
      createdById: asst1.id,
      criteria: {
        create: [
          ["TC1.1", "Mục tiêu, chuẩn đầu ra của chương trình đào tạo"],
          ["TC1.2", "Kế hoạch đào tạo toàn khóa, kế hoạch năm học"],
          ["TC2.1", "Đề cương chi tiết các mô-đun, môn học"],
          ["TC2.2", "Giáo trình, tài liệu giảng dạy"],
          ["TC3.1", "Hồ sơ giảng dạy của giảng viên (giáo án, sổ tay)"],
          ["TC3.2", "Kết quả bồi dưỡng chuyên môn, nghiệp vụ của giảng viên"],
          ["TC4.1", "Danh mục thiết bị, phòng thực hành phục vụ đào tạo"],
          ["TC5.1", "Khảo sát ý kiến người học, doanh nghiệp"],
        ].map(([code, title], order) => ({ code, title, order })),
      },
    },
    include: { criteria: true },
  });
  const camp2 = await db.evidenceCampaign.create({
    data: {
      title: "Báo cáo thi đua – khen thưởng năm học 2025–2026",
      agency: "Sở Lao động – Thương binh và Xã hội tỉnh Bắc Ninh",
      openAt: new Date(now - 140 * DAY),
      closeAt: new Date(now - 95 * DAY),
      createdById: asst1.id,
      criteria: {
        create: [
          ["TĐ1", "Thành tích giảng dạy, hội giảng"],
          ["TĐ2", "Thành tích nghiên cứu khoa học"],
          ["TĐ3", "Hướng dẫn học sinh, sinh viên đạt giải"],
        ].map(([code, title], order) => ({ code, title, order })),
      },
    },
    include: { criteria: true },
  });

  const evTitles = ["Biên bản họp tổ bộ môn", "Đề cương chi tiết (bản ký duyệt)", "Giáo án điện tử học kỳ I", "Chứng nhận bồi dưỡng nghiệp vụ", "Kế hoạch giảng dạy", "Phiếu khảo sát sinh viên", "Danh mục thiết bị phòng máy"];
  const flows: string[][] = [
    ["SUBMIT"],
    ["SUBMIT"],
    ["SUBMIT"],
    ["SUBMIT", "APPROVE"],
    ["SUBMIT", "APPROVE"],
    ["SUBMIT", "APPROVE"],
    ["SUBMIT", "APPROVE"],
    ["SUBMIT", "REJECT"],
    ["SUBMIT", "REJECT", "RESUBMIT"],
    ["SUBMIT", "REJECT", "RESUBMIT", "APPROVE"],
  ];
  const statusAfter = (flow: string[]) => {
    const last = flow[flow.length - 1];
    return last === "APPROVE" ? "APPROVED" : last === "REJECT" ? "REJECTED" : "SUBMITTED";
  };
  const comments: Record<string, string | null> = {
    SUBMIT: null,
    RESUBMIT: "Đã bổ sung bản có chữ ký.",
    APPROVE: "Hồ sơ đầy đủ, đồng ý.",
    REJECT: "Thiếu chữ ký của tổ trưởng bộ môn, đề nghị bổ sung.",
  };
  let k = 0;
  for (const [camp, count, ageBase] of [
    [camp1, 22, 18],
    [camp2, 9, 130],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const flow = camp === camp2 ? ["SUBMIT", "APPROVE"] : flows[k++ % flows.length];
      const submitter = lecturers[(i * 5) % lecturers.length];
      const crit = camp.criteria[i % camp.criteria.length];
      const created = new Date(now - (ageBase - i * 0.6) * DAY);
      const ev = await db.evidence.create({
        data: {
          campaignId: camp.id,
          criterionId: crit.id,
          submitterId: submitter.id,
          title: `${pick(evTitles)} – ${submitter.name.split(" ").slice(-1)[0]}`,
          description: "Minh chứng kèm bản scan có xác nhận.",
          status: statusAfter(flow),
          createdAt: created,
        },
      });
      let t = created.getTime();
      for (const action of flow) {
        await db.evidenceLog.create({
          data: {
            evidenceId: ev.id,
            actorId: action === "APPROVE" || action === "REJECT" ? pick([head, asst1]).id : submitter.id,
            action,
            comment: comments[action],
            createdAt: new Date(t),
          },
        });
        t += (0.5 + rand() * 2) * DAY;
      }
      await sampleFile(`minh-chung-${crit.code}-${i + 1}.txt`, `Minh chứng cho tiêu chí ${crit.code}: ${crit.title}`, submitter.id, { evidenceId: ev.id });
    }
  }

  // ───────── Module 4: Thời khóa biểu ─────────
  const rooms = [];
  for (let i = 1; i <= 5; i++) rooms.push(await db.room.create({ data: { code: `A2.10${i}`, name: `Phòng lý thuyết A2.10${i}`, type: "THEORY", capacity: 45 } }));
  for (let i = 1; i <= 5; i++) rooms.push(await db.room.create({ data: { code: `A3.20${i}`, name: `Phòng thực hành A3.20${i}`, type: "LAB", capacity: 40 } }));
  const classes = [];
  for (const [code, name] of [
    ["CNTT-K24A", "CĐ Công nghệ thông tin K24A"],
    ["CNTT-K24B", "CĐ Công nghệ thông tin K24B"],
    ["CNTT-K25A", "CĐ Công nghệ thông tin K25A"],
    ["CNTT-K25B", "CĐ Công nghệ thông tin K25B"],
    ["QTM-K25", "CĐ Quản trị mạng máy tính K25"],
    ["TKĐH-K25", "CĐ Thiết kế đồ họa K25"],
    ["CNTT-K26A", "CĐ Công nghệ thông tin K26A"],
    ["CNTT-K26B", "CĐ Công nghệ thông tin K26B"],
  ])
    classes.push(await db.classGroup.create({ data: { code, name, size: 30 + Math.floor(rand() * 15) } }));
  const subjectSpecs: [string, string, Kind, number][] = [
    ["MH01", "Cấu trúc dữ liệu và giải thuật", "MH", 60],
    ["MH02", "Cơ sở dữ liệu", "MH", 60],
    ["MH03", "Mạng máy tính", "MH", 45],
    ["MH04", "Kiến trúc máy tính", "MH", 45],
    ["MH05", "Phân tích thiết kế hệ thống", "MH", 60],
    ["MH06", "An toàn thông tin", "MH", 45],
    ["MĐ01", "Lập trình C#", "MD", 90],
    ["MĐ02", "Lập trình Web", "MD", 90],
    ["MĐ03", "Quản trị mạng Windows Server", "MD", 75],
    ["MĐ04", "Lắp ráp và bảo trì máy tính", "MD", 75],
    ["MĐ05", "Lập trình Android", "MD", 90],
    ["MĐ06", "Thiết kế đồ họa với Photoshop", "MD", 75],
  ];
  const subjects: Awaited<ReturnType<typeof db.subject.create>>[] = [];
  for (const [code, name, kind, hours] of subjectSpecs) subjects.push(await db.subject.create({ data: { code, name, kind, hours } }));
  // Kế hoạch giảng dạy của lớp: mỗi lớp 3 học phần (3 + 2 + 2 = 7 buổi/tuần) → 56 buổi cho 12 GV
  for (let c = 0; c < classes.length; c++) {
    const subs = [0, 1, 2].map((k) => subjects[(c * 3 + k) % subjects.length]);
    for (const [k, sub] of subs.entries()) {
      await db.classSubject.create({ data: { classGroupId: classes[c].id, subjectId: sub.id, sessionsPerWeek: [3, 2, 2][k] } });
    }
  }
  // Giảng viên đăng ký môn có thể dạy: 2 môn chuyên môn chính + 1 môn phụ
  const mainSubjects = [[6, 0], [2, 8], [1, 4], [9, 3], [11, 4], [7, 5], [4, 1], [5, 2], [10, 0], [8, 2], [0, 6], [3, 9]];
  for (let g = 0; g < lecturers.length; g++) {
    const ids = new Set([...mainSubjects[g], (g + 5) % subjects.length].map((i) => subjects[i].id));
    for (const subjectId of ids) await db.teachingPreference.create({ data: { userId: lecturers[g].id, subjectId } });
  }

  // Xếp TKB mẫu bằng đúng quy trình của hệ thống: phân bổ giảng viên → xếp lịch tuần
  const plans = await db.classSubject.findMany({ include: { subject: true } });
  const prefs = await db.teachingPreference.findMany();
  const sol = planTimetable({
    demands: plans.map((p) => ({ classGroupId: p.classGroupId, subjectId: p.subjectId, kind: p.subject.kind as Kind, sessions: p.sessionsPerWeek })),
    lecturers: lecturers.map((l) => ({ id: l.id, registered: prefs.filter((p) => p.userId === l.id).map((p) => p.subjectId) })),
    rooms: rooms.map((r) => ({ id: r.id, type: r.type as RoomType })),
    seed: 2026,
  });
  if (!sol.ok) throw new Error("Không xếp được TKB mẫu: " + sol.errors.join("; "));
  const tt = await db.timetable.create({
    data: { name: "TKB Học kỳ I 2026–2027 (chính thức)", status: "PUBLISHED", note: `Xếp tự động: ${sol.entries.length} buổi, ${sol.stats.ms}ms. ${sol.warnings.join(" ")}`.trim() },
  });
  const idByKey = new Map<string, string>();
  for (const a of sol.allocation.allocations) {
    const row = await db.teachingAssignment.create({
      data: { lecturerId: a.lecturerId, classGroupId: a.classGroupId, subjectId: a.subjectId, sessionsPerWeek: a.sessions, outsideRegistration: a.outsideRegistration, timetableId: tt.id },
    });
    idByKey.set(a.key, row.id);
  }
  await db.timetableEntry.createMany({
    data: sol.entries.map((e) => ({ timetableId: tt.id, assignmentId: idByKey.get(e.assignmentId)!, day: e.day, slot: e.slot, roomId: e.roomId })),
  });

  // ───────── Module 5: Công việc ─────────
  const taskTitles = [
    "Cập nhật đề cương chi tiết theo mẫu mới",
    "Biên soạn ngân hàng câu hỏi thi kết thúc mô-đun",
    "Rà soát giáo án điện tử học kỳ I",
    "Chuẩn bị bài hội giảng cấp Khoa",
    "Tổng hợp điểm quá trình lớp chủ nhiệm",
    "Kiểm tra, cài đặt phần mềm phòng máy",
    "Hướng dẫn sinh viên thực tập doanh nghiệp",
    "Viết báo cáo chuyên đề NCKH",
    "Xây dựng bài giảng E-learning",
    "Đề xuất mua sắm thiết bị thực hành",
    "Coi thi và chấm thi giữa kỳ",
    "Tham gia tư vấn tuyển sinh tại trường THPT",
    "Hoàn thiện hồ sơ minh chứng kiểm định",
    "Cập nhật lý lịch khoa học",
  ];
  for (const lec of lecturers) {
    // Mỗi giảng viên có "phong độ" khác nhau để biểu đồ hiệu suất phân hóa rõ
    const reliability = 0.45 + rand() * 0.55;
    const n = 4 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      const due = -100 + Math.floor(rand() * 115); // từ 100 ngày trước đến 15 ngày tới
      const dueAt = daysFromNow(due);
      const workload = 1 + Math.floor(rand() * 5);
      let status = "TODO";
      let submittedAt: Date | null = null;
      let completedAt: Date | null = null;
      let qualityScore: number | null = null;
      if (due < -3) {
        if (rand() < 0.9) {
          const late = rand() < reliability ? -rand() * 3 : rand() * 9;
          submittedAt = new Date(dueAt.getTime() + late * DAY);
          completedAt = submittedAt;
          status = "DONE";
          qualityScore = Math.max(2, Math.min(5, Math.round(2.5 + reliability * 2.5 + (rand() - 0.5))));
        } else status = pick(["IN_PROGRESS", "REVISION"]);
      } else if (due < 3) {
        status = pick(["IN_PROGRESS", "SUBMITTED", "TODO"]);
        if (status === "SUBMITTED") submittedAt = new Date(dueAt.getTime() - rand() * 2 * DAY);
      } else status = pick(["TODO", "IN_PROGRESS"]);
      const task = await db.task.create({
        data: {
          title: pick(taskTitles),
          description: "Thực hiện theo kế hoạch công tác của Khoa. Liên hệ người giao việc nếu cần hỗ trợ.",
          criteria: "Đúng mẫu biểu quy định\nNộp bản mềm lên hệ thống\nCó xác nhận của tổ trưởng bộ môn",
          assigneeId: lec.id,
          assignerId: pick([head, asst1, asst2]).id,
          priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"]),
          workload,
          dueAt,
          status,
          submittedAt,
          completedAt,
          qualityScore,
          reviewNote: status === "REVISION" ? "Bổ sung phần tài liệu tham khảo." : qualityScore && qualityScore >= 4 ? "Hoàn thành tốt." : null,
          createdAt: new Date(dueAt.getTime() - (7 + rand() * 14) * DAY),
        },
      });
      if (status !== "TODO" && rand() < 0.4) {
        await db.taskComment.create({ data: { taskId: task.id, userId: lec.id, content: "Em đã nhận việc, sẽ hoàn thành đúng hạn ạ.", createdAt: new Date(task.createdAt.getTime() + DAY) } });
      }
    }
  }

  // ───────── Module 6: Kho tri thức ─────────
  const note = "\n\n_Nội dung mẫu để chạy thử – cần thay bằng quy định chính thức của Khoa/Trường._";
  const kb: [string, string, string, string][] = [
    [
      "Quy trình xin nghỉ phép năm",
      "Nhân sự",
      "nghỉ phép, phép năm, đơn xin nghỉ",
      "## Đối tượng\nCán bộ, giảng viên cơ hữu của Khoa.\n\n## Các bước thực hiện\n1. Điền **Đơn xin nghỉ phép** (Biểu mẫu BM-01 trong mục Văn bản) trước ít nhất **03 ngày làm việc**.\n2. Nếu nghỉ trùng lịch dạy: ghi rõ phương án dạy bù hoặc người dạy thay vào đơn.\n3. Gửi đơn cho Quản lý khoa để kiểm tra lịch giảng dạy.\n4. Quản lý khoa ký duyệt và chuyển Phòng Tổ chức – Hành chính.\n\n## Lưu ý\n- Số ngày phép năm theo quy định của Bộ luật Lao động (tối thiểu 12 ngày/năm, cộng thâm niên).\n- Trường hợp ốm đau đột xuất: báo Quản lý khoa qua điện thoại trong buổi sáng, bổ sung đơn sau khi đi làm trở lại.",
    ],
    [
      "Quy định đổi giờ, dạy bù",
      "Đào tạo",
      "đổi giờ, dạy bù, nghỉ dạy, đổi lịch",
      "1. Giảng viên muốn đổi giờ dạy phải đăng ký với Quản lý khoa trước **ít nhất 02 ngày**.\n2. Buổi dạy bù phải được xếp trong vòng **02 tuần** kể từ buổi nghỉ.\n3. Quản lý khoa kiểm tra phòng trống trên Thời khóa biểu, cập nhật và thông báo cho lớp.\n4. Mô-đun (MĐ) phải dạy bù tại phòng thực hành; Môn học (MH) dạy bù tại phòng lý thuyết.\n5. Mỗi học kỳ, một giảng viên không đổi giờ quá **04 buổi** nếu không có lý do đặc biệt.",
    ],
    [
      "Định mức giờ giảng và cách tính giờ chuẩn",
      "Đào tạo",
      "giờ chuẩn, định mức, giờ giảng, vượt giờ",
      "## Định mức\n- Giảng viên dạy **đúng 5 buổi/tuần** theo thời khóa biểu của Khoa.\n- Buổi Mô-đun (MĐ) tính **6 giờ**, buổi Môn học (MH) tính **5 giờ**.\n\n## Quy đổi giờ chuẩn\n- 1 giờ dạy lý thuyết = 1 giờ chuẩn.\n- 1 giờ dạy thực hành tại xưởng/phòng máy = 0,75 giờ chuẩn (áp dụng theo quy chế chi tiêu nội bộ).\n- Giờ vượt định mức được thanh toán vào cuối năm học sau khi Phòng Đào tạo xác nhận.",
    ],
    [
      "Hướng dẫn mượn, trả thiết bị dạy học",
      "Trang thiết bị",
      "mượn máy chiếu, mượn laptop, thiết bị, QR",
      "1. Mở mục **Trang thiết bị**, tìm thiết bị cần mượn (hoặc quét mã QR dán trên thiết bị bằng camera điện thoại).\n2. Bấm **Đăng ký mượn**, nhập mục đích và thời gian mượn – trả.\n3. Quản lý khoa duyệt yêu cầu trên hệ thống; nhận thiết bị tại Văn phòng Khoa (A1.104).\n4. Khi trả, kiểm tra tình trạng cùng Quản lý khoa. Thiết bị hư hỏng sẽ được chuyển sang trạng thái Bảo trì.\n\n**Lưu ý:** trả thiết bị đúng hạn; quá hạn 2 lần trong học kỳ sẽ bị tạm dừng quyền mượn.",
    ],
    [
      "Hồ sơ giảng dạy giảng viên cần chuẩn bị",
      "Đào tạo",
      "hồ sơ giảng dạy, giáo án, giảng viên mới, sổ tay",
      "Mỗi học kỳ, giảng viên chuẩn bị đầy đủ:\n- Chương trình, đề cương chi tiết mô-đun/môn học được giao.\n- Kế hoạch giảng dạy (theo mẫu Phòng Đào tạo).\n- Giáo án (bản in hoặc điện tử) cho từng bài.\n- Sổ tay giáo viên, sổ lên lớp.\n- Đề kiểm tra, đáp án và bảng điểm.\n\nGiảng viên mới: liên hệ Quản lý khoa để được cấp tài khoản Cổng quản trị, nhận mẫu biểu và được phân công người hướng dẫn trong học kỳ đầu.",
    ],
    [
      "Quy trình nộp và duyệt minh chứng",
      "Kiểm định",
      "minh chứng, kiểm định, duyệt, sở",
      "1. Vào mục **Minh chứng Sở ban ngành**, chọn đợt đang mở.\n2. Chọn đúng **tiêu chí**, nhập tên minh chứng và đính kèm tệp (PDF/ảnh scan có chữ ký).\n3. Hồ sơ được chuyển tới **Quản lý khoa** phê duyệt (một lần). Tên người duyệt và thời gian được ghi vào lịch sử, không thể sửa.\n4. Nếu bị trả hồ sơ, xem lý do trong lịch sử xử lý, bổ sung và bấm **Nộp lại**.\n\nQuản lý khoa có thể xuất báo cáo toàn bộ minh chứng ra Excel để gửi Sở.",
    ],
    [
      "Quy định về coi thi, chấm thi",
      "Khảo thí",
      "coi thi, chấm thi, đề thi, phúc khảo",
      "- Đề thi kết thúc mô-đun/môn học nộp cho Quản lý khoa trước kỳ thi **10 ngày**, kèm đáp án và thang điểm.\n- Mỗi phòng thi có 02 cán bộ coi thi; có mặt trước giờ thi 15 phút.\n- Bài thi chấm 2 vòng độc lập đối với môn thi tự luận.\n- Điểm thi nhập lên hệ thống chậm nhất **07 ngày** sau khi thi.\n- Sinh viên phúc khảo trong vòng 05 ngày kể từ ngày công bố điểm.",
    ],
    [
      "Đăng ký đề tài nghiên cứu khoa học",
      "Nghiên cứu khoa học",
      "NCKH, đề tài, nghiên cứu, thuyết minh",
      "1. Theo dõi thông báo đăng ký đề tài trong mục Văn bản (thường vào tháng 11–12 hằng năm).\n2. Chuẩn bị phiếu đăng ký và thuyết minh đề tài theo mẫu.\n3. Nộp cho Quản lý khoa; Khoa tổ chức hội đồng xét chọn cấp Khoa.\n4. Đề tài được chọn gửi lên Phòng Khoa học – Hợp tác quốc tế xét duyệt cấp trường.\n\nMỗi giảng viên nên có ít nhất 01 sản phẩm NCKH/năm (đề tài, bài báo, giáo trình hoặc sáng kiến).",
    ],
    [
      "Chế độ công tác của giảng viên",
      "Nhân sự",
      "chế độ làm việc, thời gian làm việc, nhiệm vụ giảng viên",
      "Thời gian làm việc của giảng viên trong năm học gồm:\n- **Giảng dạy** theo định mức được phân công.\n- **Học tập, bồi dưỡng** nâng cao trình độ chuyên môn, nghiệp vụ.\n- **Nghiên cứu khoa học** và các nhiệm vụ khác do Khoa phân công.\n\nGiảng viên tham gia sinh hoạt chuyên môn định kỳ, họp Khoa hằng tháng và hoàn thành các công việc được giao trên Cổng quản trị đúng hạn.",
    ],
    [
      "Sử dụng phòng thực hành máy tính",
      "Trang thiết bị",
      "phòng máy, phòng thực hành, nội quy, cài đặt phần mềm",
      "- Giảng viên dạy buổi đầu tiên mỗi tuần kiểm tra tình trạng phòng máy và ghi vào sổ theo dõi.\n- Không tự ý cài đặt phần mềm không có bản quyền. Yêu cầu cài phần mềm gửi Quản lý khoa trước **03 ngày**.\n- Sự cố máy hỏng: ghi số máy, mô tả lỗi và báo qua mục Trang thiết bị để chuyển trạng thái Bảo trì.\n- Cuối buổi: tắt máy, tắt điều hòa, khóa cửa và bàn giao chìa khóa.",
    ],
  ];
  for (const [title, category, tags, content] of kb) {
    await db.kbArticle.create({ data: { title, category, tags, content: content + note, createdById: asst1.id } });
  }

  console.log("✔ Đã nạp dữ liệu mẫu.");
  console.log(`  Tài khoản (mật khẩu: ${process.env.SEED_PASSWORD ? "theo SEED_PASSWORD" : "Kcntt@2026"}):`);
  console.log(`  - Quản trị:   ${admin.email}`);
  console.log(`  - Quản lý khoa: ${head.email}, ${asst1.email}, ${asst2.email}`);
  console.log(`  - Giảng viên: ${lecturers[0].email} (và 11 tài khoản gv.* khác)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

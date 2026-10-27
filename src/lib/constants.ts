export const FACULTY_NAME = "Khoa Công nghệ Thông tin";
export const SCHOOL_NAME = "Trường Cao đẳng Công nghiệp Bắc Ninh";
export const APP_NAME = "Cổng quản trị Khoa CNTT";

export const ROLES = ["ADMIN", "HEAD", "ASSISTANT", "LECTURER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  HEAD: "Trưởng khoa",
  ASSISTANT: "Trợ lý khoa",
  LECTURER: "Giảng viên",
};

export const ASSET_CATEGORY: Record<string, string> = {
  LAB: "Phòng thực hành",
  COMPUTER: "Máy tính",
  PROJECTOR: "Máy chiếu & trình chiếu",
  NETWORK: "Thiết bị mạng",
  TEACHING: "Thiết bị dạy học",
  OTHER: "Khác",
};

export const ASSET_STATUS: Record<string, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Sẵn sàng", tone: "green" },
  BORROWED: { label: "Đang mượn", tone: "blue" },
  MAINTENANCE: { label: "Bảo trì", tone: "amber" },
  BROKEN: { label: "Hỏng", tone: "red" },
  LIQUIDATED: { label: "Thanh lý", tone: "slate" },
};

export const LOAN_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Chờ duyệt", tone: "amber" },
  APPROVED: { label: "Đang mượn", tone: "blue" },
  REJECTED: { label: "Từ chối", tone: "red" },
  RETURNED: { label: "Đã trả", tone: "green" },
};

export const INVENTORY_CONDITION: Record<string, { label: string; tone: Tone }> = {
  GOOD: { label: "Tốt", tone: "green" },
  DAMAGED: { label: "Hư hỏng", tone: "amber" },
  MISSING: { label: "Thất lạc", tone: "red" },
};

export const EVIDENCE_STATUS: Record<string, { label: string; tone: Tone }> = {
  SUBMITTED: { label: "Chờ Trợ lý duyệt", tone: "amber" },
  ASSISTANT_APPROVED: { label: "Chờ Trưởng khoa duyệt", tone: "blue" },
  APPROVED: { label: "Đã phê duyệt", tone: "green" },
  REJECTED: { label: "Yêu cầu bổ sung", tone: "red" },
};

export const EVIDENCE_ACTION: Record<string, string> = {
  SUBMIT: "Nộp minh chứng",
  RESUBMIT: "Nộp lại sau bổ sung",
  APPROVE_L1: "Trợ lý khoa duyệt",
  APPROVE_L2: "Trưởng khoa phê duyệt",
  REJECT: "Yêu cầu bổ sung",
};

export const TASK_STATUS: Record<string, { label: string; tone: Tone }> = {
  TODO: { label: "Chưa bắt đầu", tone: "slate" },
  IN_PROGRESS: { label: "Đang thực hiện", tone: "blue" },
  SUBMITTED: { label: "Chờ nghiệm thu", tone: "amber" },
  REVISION: { label: "Cần chỉnh sửa", tone: "red" },
  DONE: { label: "Hoàn thành", tone: "green" },
};

export const TASK_PRIORITY: Record<string, { label: string; tone: Tone }> = {
  LOW: { label: "Thấp", tone: "slate" },
  MEDIUM: { label: "Trung bình", tone: "blue" },
  HIGH: { label: "Cao", tone: "red" },
};

export const SUBJECT_KIND: Record<string, { label: string; short: string; hours: number }> = {
  MD: { label: "Mô-đun", short: "MĐ", hours: 6 },
  MH: { label: "Môn học", short: "MH", hours: 5 },
};

export const DAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6"];
/** Giờ bắt đầu mỗi ca (giờ thập phân). Kết thúc = bắt đầu + 6 giờ (MĐ) hoặc 5 giờ (MH) */
export const SLOTS = [
  { label: "Sáng", start: 6.5 },
  { label: "Chiều", start: 13 },
];

export function slotTime(slot: number, kind: string) {
  const start = SLOTS[slot]?.start ?? 7;
  const end = start + (SUBJECT_KIND[kind]?.hours ?? 5);
  const f = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
  return `${f(start)}–${f(end)}`;
}
/** Số buổi dạy bắt buộc của mỗi giảng viên trong một tuần */
export const SESSIONS_PER_LECTURER = 5;

export type Tone = "green" | "blue" | "amber" | "red" | "slate" | "violet";

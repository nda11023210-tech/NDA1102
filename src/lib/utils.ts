import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const TZ = "Asia/Ho_Chi_Minh";

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function fmtRelative(d: Date | string) {
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
  if (Math.abs(days) >= 1) return rtf.format(days, "day");
  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) >= 1) return rtf.format(hours, "hour");
  return rtf.format(Math.round(diff / 60_000), "minute");
}

export function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("vi-VN").format(v) + " đ";
}

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Bỏ dấu tiếng Việt, chữ thường – dùng cho tìm kiếm */
export function normalizeVi(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  const prev = parts.length > 1 ? parts[parts.length - 2] : "";
  return ((prev[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

/** Đọc chuỗi từ FormData, trả về "" nếu không có */
export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Chuỗi "yyyy-mm-ddThh:mm" cho input datetime-local theo giờ Việt Nam */
export function toLocalInput(d: Date) {
  const vn = new Date(d.getTime() + 7 * 3_600_000);
  return vn.toISOString().slice(0, 16);
}

/** Chuyển giá trị input datetime-local / date (giờ Việt Nam) sang Date */
export function fromLocalInput(v: string) {
  if (!v) return null;
  const withTime = v.length === 10 ? `${v}T00:00` : v;
  const d = new Date(`${withTime}:00+07:00`);
  return isNaN(d.getTime()) ? null : d;
}

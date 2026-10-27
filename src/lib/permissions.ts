import type { Role } from "./constants";

type U = { role: Role };
const manager = (u: U) => u.role === "ADMIN" || u.role === "MANAGER";

/** Trạng thái minh chứng đang chờ duyệt (ASSISTANT_APPROVED là trạng thái của quy trình 2 cấp cũ) */
export const PENDING_EVIDENCE = ["SUBMITTED", "ASSISTANT_APPROVED"];

/** Quản lý khoa duyệt minh chứng một lần là xong */
export function canReviewEvidence(u: U, status: string) {
  return manager(u) && PENDING_EVIDENCE.includes(status);
}

export function reviewQueueStatuses(u: U) {
  return manager(u) ? PENDING_EVIDENCE : [];
}

export const canAssignTasks = manager;
export const canViewAllPerformance = manager;
export const canManageTimetable = manager;
export const canManageKb = manager;

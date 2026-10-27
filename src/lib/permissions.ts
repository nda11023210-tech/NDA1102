import type { Role } from "./constants";

type U = { role: Role };
const is = (u: U, ...roles: Role[]) => u.role === "ADMIN" || roles.includes(u.role);

/** Người dùng có thể duyệt minh chứng ở trạng thái hiện tại không */
export function canReviewEvidence(u: U, status: string) {
  return (status === "SUBMITTED" && is(u, "ASSISTANT")) || (status === "ASSISTANT_APPROVED" && is(u, "HEAD"));
}

/** Trạng thái minh chứng mà vai trò này cần xử lý */
export function reviewQueueStatuses(u: U) {
  if (u.role === "ADMIN") return ["SUBMITTED", "ASSISTANT_APPROVED"];
  if (u.role === "ASSISTANT") return ["SUBMITTED"];
  if (u.role === "HEAD") return ["ASSISTANT_APPROVED"];
  return [];
}

export const canAssignTasks = (u: U) => is(u, "HEAD", "ASSISTANT");
export const canViewAllPerformance = (u: U) => is(u, "HEAD");
export const canManageTimetable = (u: U) => is(u, "HEAD", "ASSISTANT");
export const canManageKb = (u: U) => is(u, "HEAD", "ASSISTANT");

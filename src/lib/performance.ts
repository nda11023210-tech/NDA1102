/**
 * Chấm điểm hiệu suất tự động dựa trên trọng số.
 *
 *  Điểm tổng = 40% Tiến độ + 30% Khối lượng + 30% Chất lượng   (thang 100)
 *
 *  - Tiến độ (mỗi công việc):  đúng hạn 100 · trễ ≤2 ngày 70 · trễ ≤7 ngày 40 · trễ hơn 20 · quá hạn chưa nộp 0
 *    (công việc chưa đến hạn và chưa nộp không tính).
 *  - Khối lượng: tổng điểm khối lượng (1–5 mỗi việc) so với người cao nhất trong Khoa.
 *  - Chất lượng: điểm nghiệm thu trung bình (1–5 sao) quy đổi thang 100.
 *  Thành phần nào chưa có dữ liệu sẽ được bỏ qua và chia lại trọng số.
 */

export const WEIGHTS = { timeliness: 0.4, workload: 0.3, quality: 0.3 } as const;

export type PerfTask = {
  assigneeId: string;
  status: string;
  dueAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  workload: number;
  qualityScore: number | null;
};

export type PerfResult = {
  userId: string;
  total: number;
  timeliness: number | null;
  workload: number;
  quality: number | null;
  counts: { total: number; done: number; onTime: number; late: number; overdue: number; open: number };
  rating: { label: string; tone: "green" | "blue" | "amber" | "red" };
};

const DAY = 86_400_000;

export function taskTimeliness(t: PerfTask, now = new Date()): number | null {
  const finishedAt = t.submittedAt ?? t.completedAt;
  const finished = ["SUBMITTED", "DONE"].includes(t.status) && finishedAt;
  if (!finished) return t.dueAt < now ? 0 : null;
  const lateDays = (finishedAt.getTime() - t.dueAt.getTime()) / DAY;
  if (lateDays <= 0) return 100;
  if (lateDays <= 2) return 70;
  if (lateDays <= 7) return 40;
  return 20;
}

export function ratingOf(score: number): PerfResult["rating"] {
  if (score >= 85) return { label: "Xuất sắc", tone: "green" };
  if (score >= 70) return { label: "Tốt", tone: "blue" };
  if (score >= 50) return { label: "Đạt", tone: "amber" };
  return { label: "Cần cải thiện", tone: "red" };
}

export function computePerformance(userIds: string[], tasks: PerfTask[], now = new Date()): PerfResult[] {
  const loads = new Map(userIds.map((id) => [id, 0]));
  for (const t of tasks) loads.set(t.assigneeId, (loads.get(t.assigneeId) ?? 0) + t.workload);
  const maxLoad = Math.max(1, ...loads.values());

  return userIds.map((userId) => {
    const mine = tasks.filter((t) => t.assigneeId === userId);
    const tl = mine.map((t) => taskTimeliness(t, now)).filter((v): v is number => v !== null);
    const q = mine.filter((t) => t.status === "DONE" && t.qualityScore).map((t) => (t.qualityScore! / 5) * 100);
    const timeliness = tl.length ? tl.reduce((a, b) => a + b, 0) / tl.length : null;
    const quality = q.length ? q.reduce((a, b) => a + b, 0) / q.length : null;
    const workload = ((loads.get(userId) ?? 0) / maxLoad) * 100;

    let wSum = WEIGHTS.workload;
    let score = workload * WEIGHTS.workload;
    if (timeliness !== null) {
      score += timeliness * WEIGHTS.timeliness;
      wSum += WEIGHTS.timeliness;
    }
    if (quality !== null) {
      score += quality * WEIGHTS.quality;
      wSum += WEIGHTS.quality;
    }
    const total = mine.length ? score / wSum : 0;

    const finishedOnTime = mine.filter((t) => taskTimeliness(t, now) === 100).length;
    return {
      userId,
      total: Math.round(total * 10) / 10,
      timeliness: timeliness === null ? null : Math.round(timeliness),
      workload: Math.round(workload),
      quality: quality === null ? null : Math.round(quality),
      counts: {
        total: mine.length,
        done: mine.filter((t) => t.status === "DONE").length,
        onTime: finishedOnTime,
        late: mine.filter((t) => {
          const v = taskTimeliness(t, now);
          return v !== null && v > 0 && v < 100;
        }).length,
        overdue: mine.filter((t) => !["SUBMITTED", "DONE"].includes(t.status) && t.dueAt < now).length,
        open: mine.filter((t) => !["SUBMITTED", "DONE"].includes(t.status)).length,
      },
      rating: ratingOf(total),
    };
  });
}

import Link from "next/link";
import { Gauge, Timer, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewAllPerformance } from "@/lib/permissions";
import { computePerformance, WEIGHTS } from "@/lib/performance";
import { aiEnabled } from "@/lib/ai";
import { cn, fmtDateTime } from "@/lib/utils";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { generateReview } from "./actions";
import { PersonRadar, ScoreBreakdownChart, type ScoreRow } from "./charts";
import { RichText } from "@/components/rich-text";

export const metadata = { title: "Hiệu suất" };

const PERIODS = [30, 90, 180, 365];

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ days?: string; u?: string }> }) {
  const user = await requireUser();
  const all = canViewAllPerformance(user);
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 90;
  const since = new Date(Date.now() - days * 86_400_000);

  const [staff, tasks] = await Promise.all([
    db.user.findMany({ where: { active: true, role: { not: "ADMIN" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.task.findMany({ where: { dueAt: { gte: since } } }),
  ]);
  const results = computePerformance(staff.map((s) => s.id), tasks);
  const active = results.filter((r) => r.counts.total > 0);
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  const focusId = all ? (sp.u ?? null) : user.id;
  const focus = focusId ? results.find((r) => r.userId === focusId) : null;

  const mean = (k: "timeliness" | "workload" | "quality") => {
    const vals = active.map((r) => r[k]).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };
  const avgScore = active.length ? active.reduce((a, r) => a + r.total, 0) / active.length : 0;
  const finished = tasks.filter((t) => ["SUBMITTED", "DONE"].includes(t.status)).length;
  const onTime = active.reduce((a, r) => a + r.counts.onTime, 0);
  const overdue = active.reduce((a, r) => a + r.counts.overdue, 0);

  const rows: ScoreRow[] = [...active]
    .sort((a, b) => b.total - a.total)
    .map((r) => {
      // Chia lại trọng số khi thiếu thành phần để tổng các đoạn đúng bằng điểm tổng
      const parts = { timeliness: r.timeliness, workload: r.workload, quality: r.quality };
      const wSum = (parts.timeliness !== null ? WEIGHTS.timeliness : 0) + WEIGHTS.workload + (parts.quality !== null ? WEIGHTS.quality : 0);
      return {
        name: nameOf.get(r.userId) ?? "",
        timeliness: ((parts.timeliness ?? 0) * WEIGHTS.timeliness) / wSum,
        workload: (parts.workload * WEIGHTS.workload) / wSum,
        quality: ((parts.quality ?? 0) * WEIGHTS.quality) / wSum,
        total: r.total,
      };
    });

  const reviews = focusId ? await db.performanceReview.findMany({ where: { userId: focusId }, orderBy: { createdAt: "desc" }, take: 3 }) : [];
  const href = (p: { days?: number; u?: string | null }) => {
    const q = new URLSearchParams();
    q.set("days", String(p.days ?? days));
    const u = p.u === undefined ? sp.u : p.u;
    if (u && all) q.set("u", u);
    return `/hieu-suat?${q}`;
  };

  return (
    <>
      <PageHeader
        title={all ? "Hiệu suất giảng viên" : "Hiệu suất của tôi"}
        description={`Chấm điểm tự động theo trọng số: Tiến độ ${WEIGHTS.timeliness * 100}% · Khối lượng ${WEIGHTS.workload * 100}% · Chất lượng nghiệm thu ${WEIGHTS.quality * 100}%. AI hỗ trợ viết nhận xét, kết luận cuối cùng thuộc về Quản lý khoa.`}
        actions={
          <nav aria-label="Kỳ đánh giá" className="inline-flex gap-1 rounded-xl bg-slate-200/60 p-1">
            {PERIODS.map((d) => (
              <Link key={d} href={href({ days: d })} className={cn("tab", d === days && "tab-active")}>
                {d === 365 ? "1 năm" : `${d} ngày`}
              </Link>
            ))}
          </nav>
        }
      />

      {all && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Gauge} label="Điểm trung bình Khoa" value={avgScore.toFixed(1)} hint={`${active.length} người có công việc trong kỳ`} />
            <StatCard icon={CheckCircle2} label="Việc đã hoàn thành/nộp" value={finished} hint={`trên ${tasks.length} việc trong kỳ`} tone="green" />
            <StatCard icon={Timer} label="Nộp đúng hạn" value={`${finished ? Math.round((onTime / finished) * 100) : 0}%`} hint={`${onTime} việc`} tone="violet" />
            <StatCard icon={AlertTriangle} label="Đang quá hạn" value={overdue} tone={overdue ? "red" : "slate"} href="/cong-viec?tab=tat-ca" />
          </div>

          <Card title="Điểm hiệu suất theo giảng viên" className="mb-6">
            {rows.length ? <ScoreBreakdownChart rows={rows} /> : <p className="py-10 text-center text-sm text-ink-muted">Chưa có dữ liệu trong kỳ.</p>}
          </Card>

          <Card title="Bảng chi tiết" className="mb-6" bodyClassName="overflow-x-auto">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th>Giảng viên</th>
                  <th className="text-right">Tiến độ</th>
                  <th className="text-right">Khối lượng</th>
                  <th className="text-right">Chất lượng</th>
                  <th className="text-right">Tổng</th>
                  <th>Xếp loại</th>
                  <th className="text-right">Việc (xong/tổng · quá hạn)</th>
                </tr>
              </thead>
              <tbody>
                {[...results]
                  .sort((a, b) => b.total - a.total)
                  .map((r) => (
                    <tr key={r.userId} className={cn(r.userId === focusId && "bg-brand-50")}>
                      <td>
                        <Link href={href({ u: r.userId })} className="font-medium text-action hover:underline">
                          {nameOf.get(r.userId)}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{r.timeliness ?? "—"}</td>
                      <td className="text-right tabular-nums">{r.counts.total ? r.workload : "—"}</td>
                      <td className="text-right tabular-nums">{r.quality ?? "—"}</td>
                      <td className="text-right font-semibold tabular-nums">{r.counts.total ? r.total.toFixed(1) : "—"}</td>
                      <td>{r.counts.total ? <Badge tone={r.rating.tone}>{r.rating.label}</Badge> : <span className="text-xs text-ink-muted">Chưa có việc</span>}</td>
                      <td className="text-right text-ink-muted tabular-nums">
                        {r.counts.done}/{r.counts.total}
                        {r.counts.overdue > 0 && <span className="font-medium text-red-700"> · {r.counts.overdue}</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {focus && (
        <div id="ca-nhan" className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          <Card title={nameOf.get(focus.userId)}>
            <div className="mb-2 flex items-end justify-between">
              <div>
                <div className="text-sm text-ink-muted">Điểm tổng</div>
                <div className="text-4xl font-bold text-ink tabular-nums">{focus.total.toFixed(1)}</div>
              </div>
              <Badge tone={focus.rating.tone} className="text-sm">
                {focus.rating.label}
              </Badge>
            </div>
            <PersonRadar
              me={{ timeliness: focus.timeliness ?? 0, workload: focus.workload, quality: focus.quality ?? 0 }}
              avg={{ timeliness: mean("timeliness"), workload: mean("workload"), quality: mean("quality") }}
            />
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-slate-50 py-2">
                <dt className="text-xs text-ink-muted">Đúng hạn</dt>
                <dd className="font-semibold tabular-nums">{focus.counts.onTime}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <dt className="text-xs text-ink-muted">Trễ hạn</dt>
                <dd className="font-semibold tabular-nums">{focus.counts.late}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <dt className="text-xs text-ink-muted">Quá hạn</dt>
                <dd className="font-semibold text-red-700 tabular-nums">{focus.counts.overdue}</dd>
              </div>
            </dl>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <Sparkles className="size-4 text-violet-600" aria-hidden /> Nhận xét hiệu suất {aiEnabled() ? "(Claude AI)" : "(tự động)"}
              </span>
            }
          >
            <ActionForm action={generateReview} resetOnSuccess={false} className="mb-5">
              <input type="hidden" name="userId" value={focus.userId} />
              <input type="hidden" name="days" value={days} />
              <SubmitButton className="btn btn-brand" pendingText="AI đang phân tích…">
                <Sparkles className="size-4" aria-hidden /> Tạo nhận xét cho kỳ {days} ngày
              </SubmitButton>
            </ActionForm>
            {reviews.length === 0 ? (
              <p className="text-sm text-ink-muted">Chưa có nhận xét. Bấm nút trên để AI phân tích số liệu công việc trong kỳ.</p>
            ) : (
              <div className="space-y-5">
                {reviews.map((r, i) => (
                  <article key={r.id} className={cn(i > 0 && "border-t border-line pt-5 opacity-80")}>
                    <div className="mb-2 text-xs text-ink-muted">
                      {fmtDateTime(r.createdAt)} · Kỳ {r.period} · Điểm {r.score.toFixed(1)}
                    </div>
                    <RichText text={r.summary} />
                  </article>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {all && !focus && <p className="text-center text-sm text-ink-muted">Bấm tên một giảng viên trong bảng để xem chi tiết và tạo nhận xét AI.</p>}
    </>
  );
}

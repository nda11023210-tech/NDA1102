import Link from "next/link";
import { FileText, ListTodo, ClipboardCheck, Boxes, CalendarRange, ArrowRight, PenLine, AlertTriangle, Bot, Clock } from "lucide-react";
import { requireUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { reviewQueueStatuses } from "@/lib/permissions";
import { DAYS, ROLE_LABEL, SLOTS, SUBJECT_KIND, TASK_STATUS, slotTime, type Tone } from "@/lib/constants";
import { cn, fmtDate, fmtRelative } from "@/lib/utils";
import { Badge, Card, StatCard, StatusBadge } from "@/components/ui";

export const metadata = { title: "Bảng điều khiển" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
  return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

export default async function Dashboard() {
  const user = await requireUser();
  const manager = isManager(user);
  const now = new Date();
  const queue = reviewQueueStatuses(user);
  // Thứ trong tuần theo giờ VN: 0 = Thứ 2
  const vnDay = (new Date(now.getTime() + 7 * 3_600_000).getUTCDay() + 6) % 7;

  const [unsigned, myTasks, evidenceCount, loanCount, latestDocs, published, overdueAll] = await Promise.all([
    db.document.findMany({
      where: { requireSign: true, NOT: { receipts: { some: { userId: user.id, signedAt: { not: null } } } } },
      orderBy: [{ signDueAt: "asc" }, { issuedAt: "desc" }],
      take: 5,
      include: { category: true },
    }),
    db.task.findMany({
      where: { assigneeId: user.id, status: { in: ["TODO", "IN_PROGRESS", "REVISION"] } },
      orderBy: { dueAt: "asc" },
      take: 6,
      include: { assigner: { select: { name: true } } },
    }),
    queue.length ? db.evidence.count({ where: { status: { in: queue } } }) : db.evidence.count({ where: { submitterId: user.id, status: "REJECTED" } }),
    manager ? db.assetLoan.count({ where: { status: "PENDING" } }) : db.assetLoan.count({ where: { borrowerId: user.id, status: "APPROVED" } }),
    db.document.findMany({ orderBy: { issuedAt: "desc" }, take: 5, include: { category: true, receipts: { where: { userId: user.id } } } }),
    db.timetable.findFirst({
      where: { status: "PUBLISHED" },
      include: {
        entries: {
          where: { assignment: { lecturerId: user.id } },
          include: { room: true, assignment: { include: { classGroup: true, subject: true } } },
          orderBy: [{ day: "asc" }, { slot: "asc" }],
        },
      },
    }),
    manager ? db.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS", "REVISION"] }, dueAt: { lt: now } } }) : Promise.resolve(0),
  ]);
  const myOpenCount = await db.task.count({ where: { assigneeId: user.id, status: { in: ["TODO", "IN_PROGRESS", "REVISION"] } } });
  const lessons = published?.entries ?? [];
  const firstName = user.name.split(" ").slice(-1)[0];

  return (
    <>
      <div className="mb-7 flex flex-col gap-1">
        <p className="text-sm font-medium text-ink-muted">
          {new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(now)}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
          {greeting()}, {firstName}!
        </h1>
        <p className="text-sm text-ink-muted">
          {ROLE_LABEL[user.role]} · Đây là những việc cần bạn chú ý hôm nay.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={PenLine} label="Văn bản chờ ký nhận" value={unsigned.length} tone={unsigned.length ? "amber" : "green"} href="/van-ban?f=unsigned" />
        <StatCard icon={ListTodo} label="Công việc đang mở" value={myOpenCount} hint={myTasks.some((t) => t.dueAt < now) ? "Có việc quá hạn" : undefined} tone="blue" href="/cong-viec" />
        <StatCard
          icon={ClipboardCheck}
          label={queue.length ? "Minh chứng chờ bạn duyệt" : "Minh chứng cần bổ sung"}
          value={evidenceCount}
          tone={evidenceCount ? "violet" : "slate"}
          href={queue.length ? "/minh-chung/duyet" : "/minh-chung/cua-toi"}
        />
        <StatCard icon={Boxes} label={manager ? "Yêu cầu mượn chờ duyệt" : "Thiết bị bạn đang mượn"} value={loanCount} tone="slate" href="/tai-san/muon-tra" />
      </div>

      {manager && overdueAll > 0 && (
        <Link href="/cong-viec?tab=tat-ca" className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 transition-colors hover:bg-red-100">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span>
            Toàn Khoa đang có <strong>{overdueAll} công việc quá hạn</strong> chưa hoàn thành.
          </span>
          <ArrowRight className="ml-auto size-4" aria-hidden />
        </Link>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <CalendarRange className="size-4 text-action" aria-hidden /> Lịch dạy tuần này
            </span>
          }
          actions={
            <Link href="/thoi-khoa-bieu?view=gv" className="text-sm font-medium text-action hover:underline">
              Xem TKB
            </Link>
          }
        >
          {lessons.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">{published ? "Bạn không có buổi dạy nào trong thời khóa biểu đang công bố." : "Khoa chưa công bố thời khóa biểu."}</p>
          ) : (
            <ol className="grid gap-2 sm:grid-cols-5">
              {DAYS.map((d, day) => {
                const items = lessons.filter((l) => l.day === day);
                const today = day === vnDay;
                return (
                  <li key={d} className={cn("rounded-xl border p-2.5", today ? "border-action bg-blue-50/60" : "border-line bg-slate-50/50")}>
                    <div className={cn("mb-2 text-xs font-semibold uppercase", today ? "text-action" : "text-ink-muted")}>
                      {d}
                      {today && " · Hôm nay"}
                    </div>
                    {items.length === 0 ? (
                      <div className="py-3 text-center text-xs text-ink-muted">Trống</div>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map((l) => (
                          <div key={l.id} className={cn("rounded-lg border-l-[3px] bg-white px-2 py-1.5 text-xs shadow-sm", l.assignment.subject.kind === "MD" ? "border-violet-500" : "border-blue-500")}>
                            <div className="font-semibold text-ink">{SLOTS[l.slot].label}</div>
                            <div className="line-clamp-2 text-ink-soft">{l.assignment.subject.name}</div>
                            <div className="mt-0.5 text-ink-muted">
                              {l.assignment.classGroup.code} · P.{l.room.code}
                            </div>
                            <div className="text-ink-muted">
                              {SUBJECT_KIND[l.assignment.subject.kind].short} · {slotTime(l.slot, l.assignment.subject.kind)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card
          title="Văn bản cần ký nhận"
          actions={
            <Link href="/van-ban?f=unsigned" className="text-sm font-medium text-action hover:underline">
              Tất cả
            </Link>
          }
          bodyClassName="divide-y divide-line"
        >
          {unsigned.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-emerald-700">Bạn đã ký nhận đầy đủ văn bản.</p>
          ) : (
            unsigned.map((d) => (
              <Link key={d.id} href={`/van-ban/${d.id}`} className="block px-5 py-3 transition-colors hover:bg-slate-50">
                <div className="line-clamp-2 text-sm font-medium text-ink">{d.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                  <Badge tone={d.category.color as Tone}>{d.category.name}</Badge>
                  {d.signDueAt && (
                    <span className={cn(d.signDueAt < now && "font-medium text-red-700")}>
                      <Clock className="mr-0.5 inline size-3" aria-hidden />
                      Hạn {fmtRelative(d.signDueAt)}
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </Card>

        <Card
          className="xl:col-span-2"
          title="Công việc sắp đến hạn"
          actions={
            <Link href="/cong-viec" className="text-sm font-medium text-action hover:underline">
              Bảng công việc
            </Link>
          }
          bodyClassName="divide-y divide-line"
        >
          {myTasks.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-ink-muted">Không có công việc đang mở.</p>
          ) : (
            myTasks.map((t) => {
              const overdue = t.dueAt < now;
              return (
                <Link key={t.id} href={`/cong-viec/${t.id}`} className="flex flex-col gap-1 px-5 py-3 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{t.title}</div>
                    <div className="text-xs text-ink-muted">Giao bởi {t.assigner.name}</div>
                  </div>
                  <StatusBadge map={TASK_STATUS} value={t.status} />
                  <span className={cn("w-36 text-xs sm:text-right", overdue ? "font-semibold text-red-700" : "text-ink-muted")}>
                    {overdue ? "Quá hạn " : "Hạn "}
                    {fmtRelative(t.dueAt)}
                  </span>
                </Link>
              );
            })
          )}
        </Card>

        <div className="space-y-6">
          <Card
            title="Văn bản mới"
            actions={
              <Link href="/van-ban" className="text-sm font-medium text-action hover:underline">
                Xem thêm
              </Link>
            }
            bodyClassName="divide-y divide-line"
          >
            {latestDocs.map((d) => (
              <Link key={d.id} href={`/van-ban/${d.id}`} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                <FileText className={cn("mt-0.5 size-4 shrink-0", d.receipts[0]?.readAt ? "text-slate-400" : "text-action")} aria-hidden />
                <div className="min-w-0">
                  <div className={cn("line-clamp-1 text-sm", d.receipts[0]?.readAt ? "text-ink-soft" : "font-semibold text-ink")}>{d.title}</div>
                  <div className="text-xs text-ink-muted">
                    {d.category.name} · {fmtDate(d.issuedAt)}
                  </div>
                </div>
              </Link>
            ))}
          </Card>
          <Link href="/tro-ly" className="card card-pad flex items-center gap-4 bg-gradient-to-br from-brand-700 to-brand-900 text-white transition-shadow hover:shadow-lg">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15">
              <Bot className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="font-semibold">Hỏi Trợ lý AI</div>
              <div className="text-sm text-blue-100/85">Tra cứu quy chế, thủ tục của Khoa 24/7</div>
            </div>
            <ArrowRight className="ml-auto size-5 shrink-0" aria-hidden />
          </Link>
        </div>
      </div>
    </>
  );
}

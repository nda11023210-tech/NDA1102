import Link from "next/link";
import { ListTodo, Clock, AlertTriangle, Star } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAssignTasks } from "@/lib/permissions";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/constants";
import { cn, fmtDateTime, fmtRelative, toLocalInput } from "@/lib/utils";
import { Avatar, Badge, EmptyState, Field, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { createTask } from "./actions";

export const metadata = { title: "Công việc" };

type SP = { tab?: "cua-toi" | "da-giao" | "tat-ca"; st?: string };

const COLUMNS = ["TODO", "IN_PROGRESS", "REVISION", "SUBMITTED", "DONE"] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const assigner = canAssignTasks(user);
  const sp = await searchParams;
  const tab = sp.tab ?? "cua-toi";

  const where: Prisma.TaskWhereInput =
    tab === "da-giao" && assigner ? { assignerId: user.id } : tab === "tat-ca" && assigner ? {} : { assigneeId: user.id };
  const [tasks, staff] = await Promise.all([
    db.task.findMany({
      where,
      include: { assignee: { select: { name: true } }, assigner: { select: { name: true } }, _count: { select: { comments: true } } },
      orderBy: { dueAt: "asc" },
      take: 300,
    }),
    assigner ? db.user.findMany({ where: { active: true, role: { not: "ADMIN" } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }) : [],
  ]);
  const now = new Date();
  const defaultDue = new Date(now.getTime() + 7 * 86_400_000);
  defaultDue.setHours(17, 0, 0, 0);

  return (
    <>
      <PageHeader title="Giao việc & theo dõi tiến độ" description="Công việc được giao trực tuyến kèm hạn chót và tiêu chí nghiệm thu. Kết quả nghiệm thu là đầu vào cho đánh giá hiệu suất." />

      {assigner && (
        <Disclosure summary="Giao việc mới" className="mb-6">
          <ActionForm action={createTask} className="grid gap-4 space-y-0 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label="Tên công việc" htmlFor="title" required>
                <input id="title" name="title" required className="input" />
              </Field>
              <Field label="Mô tả" htmlFor="description">
                <textarea id="description" name="description" rows={3} className="input" />
              </Field>
              <Field label="Tiêu chí nghiệm thu" htmlFor="criteria" hint="Mỗi dòng một tiêu chí. Người nhận sẽ thấy dạng danh sách kiểm tra.">
                <textarea id="criteria" name="criteria" rows={4} className="input" placeholder={"Đúng mẫu biểu của Phòng Đào tạo\nCó chữ ký của tổ trưởng"} />
              </Field>
            </div>
            <div className="space-y-4">
              <Field label="Người thực hiện" htmlFor="assigneeId" hint="Giữ Ctrl (hoặc Cmd) để chọn nhiều người – mỗi người nhận một công việc riêng." required>
                <select id="assigneeId" name="assigneeId" multiple required size={6} className="input">
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Hạn chót" htmlFor="dueAt" required>
                  <input id="dueAt" name="dueAt" type="datetime-local" required defaultValue={toLocalInput(defaultDue)} className="input" />
                </Field>
                <Field label="Ưu tiên" htmlFor="priority">
                  <select id="priority" name="priority" defaultValue="MEDIUM" className="input">
                    {Object.entries(TASK_PRIORITY).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Khối lượng" htmlFor="workload">
                  <select id="workload" name="workload" defaultValue="2" className="input">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} – {["Rất nhỏ", "Nhỏ", "Vừa", "Lớn", "Rất lớn"][n - 1]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Tài liệu kèm theo" htmlFor="files">
                <input id="files" name="files" type="file" multiple className="input" />
              </Field>
              <SubmitButton>Giao việc</SubmitButton>
            </div>
          </ActionForm>
        </Disclosure>
      )}

      {assigner && (
        <nav aria-label="Phạm vi" className="mb-5 inline-flex gap-1 rounded-xl bg-slate-200/60 p-1">
          {(
            [
              ["cua-toi", "Việc của tôi"],
              ["da-giao", "Tôi đã giao"],
              ["tat-ca", "Toàn Khoa"],
            ] as const
          ).map(([k, label]) => (
            <Link key={k} href={`/cong-viec?tab=${k}`} className={cn("tab", tab === k && "tab-active")}>
              {label}
            </Link>
          ))}
        </nav>
      )}

      {tasks.length === 0 ? (
        <div className="card">
          <EmptyState icon={ListTodo} title="Không có công việc">
            {tab === "cua-toi" ? "Bạn chưa được giao công việc nào." : "Chưa có công việc nào trong phạm vi này."}
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = tasks.filter((t) => t.status === col);
            return (
              <section key={col} aria-label={TASK_STATUS[col].label} className="flex flex-col rounded-xl bg-slate-100/80 p-2">
                <header className="flex items-center justify-between px-2 py-1.5">
                  <StatusBadge map={TASK_STATUS} value={col} />
                  <span className="text-xs font-semibold text-ink-muted tabular-nums">{items.length}</span>
                </header>
                <div className="mt-1 flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
                  {items.map((t) => {
                    const overdue = !["SUBMITTED", "DONE"].includes(t.status) && t.dueAt < now;
                    return (
                      <Link
                        key={t.id}
                        href={`/cong-viec/${t.id}`}
                        className={cn("rounded-lg border border-line bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-md", overdue && "border-red-200")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="line-clamp-2 text-sm font-medium text-ink">{t.title}</div>
                          {t.priority === "HIGH" && <Badge tone="red">Cao</Badge>}
                        </div>
                        <div className={cn("mt-2 flex items-center gap-1 text-xs", overdue ? "font-medium text-red-700" : "text-ink-muted")}>
                          {overdue ? <AlertTriangle className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
                          <time dateTime={t.dueAt.toISOString()} title={fmtDateTime(t.dueAt)}>
                            {t.status === "DONE" ? `Hạn ${fmtDateTime(t.dueAt)}` : `${overdue ? "Quá hạn" : "Hạn"} ${fmtRelative(t.dueAt)}`}
                          </time>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
                            <Avatar name={tab === "cua-toi" ? t.assigner.name : t.assignee.name} size="sm" />
                            <span className="truncate">{tab === "cua-toi" ? `Giao bởi ${t.assigner.name}` : t.assignee.name}</span>
                          </span>
                          {t.qualityScore && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600">
                              <Star className="size-3.5 fill-current" aria-hidden />
                              {t.qualityScore}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

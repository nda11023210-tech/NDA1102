import { notFound } from "next/navigation";
import { CheckSquare, Play, Send, Star, RotateCcw, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/constants";
import { taskTimeliness } from "@/lib/performance";
import { fmtDateTime, fmtRelative } from "@/lib/utils";
import { AttachmentList, Avatar, Badge, Card, Field, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { addComment, updateTaskStatus } from "../actions";

export const metadata = { title: "Chi tiết công việc" };

export default async function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const task = await db.task.findUnique({
    where: { id },
    include: {
      assignee: true,
      assigner: true,
      attachments: { orderBy: { createdAt: "asc" } },
      comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!task) notFound();
  const isAssignee = task.assigneeId === user.id;
  const isReviewer = task.assignerId === user.id || ["ADMIN", "HEAD"].includes(user.role);
  if (!isAssignee && !isReviewer && user.role !== "ASSISTANT") notFound();

  const criteria = (task.criteria ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const now = new Date();
  const overdue = !["SUBMITTED", "DONE"].includes(task.status) && task.dueAt < now;
  const tl = taskTimeliness(task, now);

  return (
    <>
      <PageHeader
        title={task.title}
        back={{ href: "/cong-viec", label: "Công việc" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge map={TASK_STATUS} value={task.status} />
            <StatusBadge map={TASK_PRIORITY} value={task.priority} />
            <span>Khối lượng {task.workload}/5</span>
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card title="Nội dung công việc">
            {task.description ? <p className="whitespace-pre-line text-[15px] leading-7 text-ink-soft">{task.description}</p> : <p className="text-sm text-ink-muted">Không có mô tả.</p>}
            {criteria.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <CheckSquare className="size-4 text-action" aria-hidden /> Tiêu chí nghiệm thu
                </h3>
                <ul className="space-y-1.5">
                  {criteria.map((c) => (
                    <li key={c} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <CheckCircle2 className={`mt-0.5 size-4 shrink-0 ${task.status === "DONE" ? "text-emerald-600" : "text-slate-300"}`} aria-hidden />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {task.attachments.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="mb-2 text-sm font-semibold">Tệp đính kèm & sản phẩm</h3>
                <AttachmentList items={task.attachments} />
              </div>
            )}
          </Card>

          <Card title={`Trao đổi (${task.comments.length})`}>
            <ol className="space-y-4">
              {task.comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Avatar name={c.user.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-semibold">{c.user.name}</span> <span className="text-xs text-ink-muted">{fmtDateTime(c.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm whitespace-pre-line text-ink-soft">{c.content}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ActionForm action={addComment} className="mt-5 border-t border-line pt-4">
              <input type="hidden" name="taskId" value={task.id} />
              <label htmlFor="content" className="sr-only">
                Nội dung trao đổi
              </label>
              <textarea id="content" name="content" rows={2} required placeholder="Nhập trao đổi, câu hỏi, cập nhật tiến độ…" className="input" />
              <SubmitButton className="btn btn-secondary">Gửi</SubmitButton>
            </ActionForm>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Người thực hiện</dt>
                <dd className="flex items-center gap-2 font-medium">
                  <Avatar name={task.assignee.name} size="sm" /> {task.assignee.name}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Người giao</dt>
                <dd className="font-medium">{task.assigner.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Hạn chót</dt>
                <dd className={overdue ? "font-semibold text-red-700" : "font-medium"}>
                  {fmtDateTime(task.dueAt)}
                  {!["DONE", "SUBMITTED"].includes(task.status) && <span className="block text-right text-xs font-normal">{fmtRelative(task.dueAt)}</span>}
                </dd>
              </div>
              {task.submittedAt && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Nộp lúc</dt>
                  <dd className="font-medium">{fmtDateTime(task.submittedAt)}</dd>
                </div>
              )}
              {tl !== null && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Điểm tiến độ</dt>
                  <dd>
                    <Badge tone={tl === 100 ? "green" : tl >= 40 ? "amber" : "red"}>{tl === 100 ? "Đúng hạn · 100" : `${tl}/100`}</Badge>
                  </dd>
                </div>
              )}
              {task.qualityScore && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Chất lượng</dt>
                  <dd className="flex gap-0.5 text-amber-500" aria-label={`${task.qualityScore} trên 5 sao`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className={`size-4 ${i < task.qualityScore! ? "fill-current" : "text-slate-200"}`} aria-hidden />
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            {task.reviewNote && <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-soft">Nhận xét: {task.reviewNote}</p>}
          </Card>

          {isAssignee && ["TODO", "IN_PROGRESS", "REVISION"].includes(task.status) && (
            <Card title="Cập nhật tiến độ">
              {task.status !== "IN_PROGRESS" && (
                <ActionForm action={updateTaskStatus} className="mb-4">
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="intent" value="start" />
                  <SubmitButton className="btn btn-secondary w-full">
                    <Play className="size-4" aria-hidden /> Bắt đầu thực hiện
                  </SubmitButton>
                </ActionForm>
              )}
              <ActionForm action={updateTaskStatus}>
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="intent" value="submit" />
                <Field label="Báo cáo kết quả" htmlFor="note">
                  <textarea id="note" name="note" rows={3} className="input" />
                </Field>
                <Field label="Sản phẩm (tệp)" htmlFor="files">
                  <input id="files" name="files" type="file" multiple className="input" />
                </Field>
                <SubmitButton className="btn btn-primary w-full">
                  <Send className="size-4" aria-hidden /> Nộp kết quả
                </SubmitButton>
              </ActionForm>
            </Card>
          )}

          {isReviewer && task.status === "SUBMITTED" && (
            <Card title="Nghiệm thu">
              <ActionForm action={updateTaskStatus}>
                <input type="hidden" name="id" value={task.id} />
                <fieldset>
                  <legend className="label">Chất lượng hoàn thành</legend>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className="cursor-pointer">
                        <input type="radio" name="qualityScore" value={n} defaultChecked={n === 4} className="peer sr-only" />
                        <span className="grid size-10 place-items-center rounded-lg border border-line-strong text-sm font-semibold peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-700 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300">
                          {n}★
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field label="Nhận xét" htmlFor="review-note" hint="Bắt buộc khi yêu cầu chỉnh sửa.">
                  <textarea id="review-note" name="note" rows={2} className="input" />
                </Field>
                <div className="flex gap-2">
                  <SubmitButton className="btn btn-success flex-1" name="intent" value="accept">
                    <CheckCircle2 className="size-4" aria-hidden /> Nghiệm thu
                  </SubmitButton>
                  <SubmitButton className="btn btn-danger-soft" name="intent" value="revise">
                    <RotateCcw className="size-4" aria-hidden /> Yêu cầu sửa
                  </SubmitButton>
                </div>
              </ActionForm>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

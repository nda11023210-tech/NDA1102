import { Check, CornerUpLeft, Lock, Send } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { EVIDENCE_ACTION, EVIDENCE_STATUS } from "@/lib/constants";
import { cn, fmtDateTime } from "@/lib/utils";
import { AttachmentList, StatusBadge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { resubmitEvidence, reviewEvidence } from "./actions";

export const evidenceInclude = {
  criterion: true,
  campaign: { select: { id: true, title: true, agency: true } },
  submitter: { select: { id: true, name: true } },
  attachments: true,
  logs: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.EvidenceInclude;

export type EvidenceWithRelations = Prisma.EvidenceGetPayload<{ include: typeof evidenceInclude }>;

const APPROVE_ACTIONS = ["APPROVE", "APPROVE_L2"];

/** Người và thời điểm ra quyết định cuối cùng (phê duyệt hoặc trả hồ sơ) */
function lastDecision(ev: EvidenceWithRelations) {
  return [...ev.logs].reverse().find((l) => APPROVE_ACTIONS.includes(l.action) || l.action === "REJECT");
}

export function EvidenceItem({
  ev,
  canReview,
  isOwner,
  showCampaign,
}: {
  ev: EvidenceWithRelations;
  canReview: boolean;
  isOwner: boolean;
  showCampaign?: boolean;
}) {
  return (
    <article className="px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700">{ev.criterion.code}</span>
            <h3 className="font-semibold text-ink">{ev.title}</h3>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {showCampaign && (
              <>
                {ev.campaign.title} ({ev.campaign.agency}) ·{" "}
              </>
            )}
            {ev.criterion.title} · Nộp bởi <span className="font-medium text-ink-soft">{ev.submitter.name}</span>
          </p>
          {ev.description && <p className="mt-2 text-sm text-ink-soft">{ev.description}</p>}
          <div className="mt-3">
            <AttachmentList items={ev.attachments} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <StatusBadge map={EVIDENCE_STATUS} value={ev.status} />
          {(() => {
            const d = ev.status === "APPROVED" || ev.status === "REJECTED" ? lastDecision(ev) : undefined;
            return (
              d && (
                <p className="text-xs text-ink-muted lg:text-right">
                  {ev.status === "APPROVED" ? "Người duyệt" : "Người trả hồ sơ"}: <span className="font-semibold text-ink-soft">{d.actor.name}</span>
                  <br />
                  {fmtDateTime(d.createdAt)}
                </p>
              )
            );
          })()}
        </div>
      </div>

      <details className="group mt-3">
        <summary className="cursor-pointer text-sm font-medium text-action select-none">Lịch sử xử lý ({ev.logs.length})</summary>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
          <Lock className="size-3.5" aria-hidden /> Lịch sử duyệt được lưu cố định, không thể sửa hoặc xóa.
        </p>
        <ol className="mt-3 space-y-3 border-l-2 border-line pl-4">
          {ev.logs.map((l) => (
            <li key={l.id} className="relative text-sm">
              <span aria-hidden className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-2 ring-white", l.action === "REJECT" ? "bg-red-500" : l.action.startsWith("APPROVE") ? "bg-emerald-500" : "bg-blue-500")} />
              <span className="font-medium">{EVIDENCE_ACTION[l.action] ?? l.action}</span> · {l.actor.name}
              <span className="text-ink-muted"> · {fmtDateTime(l.createdAt)}</span>
              {l.comment && <p className="mt-0.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-ink-soft">“{l.comment}”</p>}
            </li>
          ))}
        </ol>
      </details>

      {canReview && (
        <ActionForm action={reviewEvidence} className="mt-4 flex flex-col gap-2 space-y-0 rounded-xl border border-line bg-slate-50/70 p-3 sm:flex-row sm:items-center">
          <input type="hidden" name="id" value={ev.id} />
          <label htmlFor={`cmt-${ev.id}`} className="sr-only">
            Ý kiến duyệt
          </label>
          <input id={`cmt-${ev.id}`} name="comment" placeholder="Ý kiến (bắt buộc khi trả hồ sơ)" className="input flex-1" />
          <div className="flex gap-2">
            <SubmitButton className="btn btn-success" name="decision" value="approve">
              <Check className="size-4" aria-hidden /> Duyệt
            </SubmitButton>
            <SubmitButton className="btn btn-danger-soft" name="decision" value="reject">
              <CornerUpLeft className="size-4" aria-hidden /> Trả hồ sơ
            </SubmitButton>
          </div>
        </ActionForm>
      )}

      {isOwner && ev.status === "REJECTED" && (
        <ActionForm action={resubmitEvidence} className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-4">
          <input type="hidden" name="id" value={ev.id} />
          <p className="text-sm font-medium text-red-800">Hồ sơ cần bổ sung – vui lòng cập nhật và nộp lại.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`desc-${ev.id}`} className="label">
                Mô tả cập nhật
              </label>
              <textarea id={`desc-${ev.id}`} name="description" rows={2} defaultValue={ev.description ?? ""} className="input" />
            </div>
            <div>
              <label htmlFor={`files-${ev.id}`} className="label">
                Tệp bổ sung
              </label>
              <input id={`files-${ev.id}`} name="files" type="file" multiple className="input" />
              <label htmlFor={`rc-${ev.id}`} className="label mt-3">
                Ghi chú gửi người duyệt
              </label>
              <input id={`rc-${ev.id}`} name="comment" className="input" />
            </div>
          </div>
          <SubmitButton>
            <Send className="size-4" aria-hidden /> Nộp lại
          </SubmitButton>
        </ActionForm>
      )}
    </article>
  );
}

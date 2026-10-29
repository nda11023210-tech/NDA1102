import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Upload, CheckCircle2, Circle, Pencil } from "lucide-react";
import { requireUser, isManager, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReviewEvidence } from "@/lib/permissions";
import { cn, fmtDate } from "@/lib/utils";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { deleteCampaign, submitEvidence } from "../actions";
import { DeleteButton } from "@/components/delete-button";
import { EvidenceItem, evidenceInclude } from "../evidence-item";

export const metadata = { title: "Đợt minh chứng" };

export default async function CampaignDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tc?: string }> }) {
  const { id } = await params;
  const { tc } = await searchParams;
  const user = await requireUser();
  const manager = isManager(user);
  const admin = isAdmin(user);
  const campaign = await db.evidenceCampaign.findUnique({
    where: { id },
    include: { criteria: { orderBy: { order: "asc" }, include: { evidences: { select: { status: true } } } } },
  });
  if (!campaign) notFound();

  const evidences = await db.evidence.findMany({
    where: { campaignId: id, ...(manager ? {} : { submitterId: user.id }), ...(tc ? { criterionId: tc } : {}) },
    include: evidenceInclude,
    orderBy: { updatedAt: "desc" },
  });
  const now = new Date();
  const open = campaign.openAt <= now && campaign.closeAt >= now;

  return (
    <>
      <PageHeader
        title={campaign.title}
        back={{ href: "/minh-chung", label: "Các đợt minh chứng" }}
        description={`${campaign.agency} · ${fmtDate(campaign.openAt)} – ${fmtDate(campaign.closeAt)}${campaign.description ? ` · ${campaign.description}` : ""}`}
        actions={
          manager && (
            <>
              <a href={`/api/minh-chung/${campaign.id}/bao-cao`} className="btn btn-secondary">
                <Download className="size-4" aria-hidden /> Xuất báo cáo Excel
              </a>
              {admin && (
              <>
              <Link href={`/minh-chung/${campaign.id}/sua`} className="btn btn-secondary">
                <Pencil className="size-4" aria-hidden /> Sửa đợt
              </Link>
              <DeleteButton
                action={deleteCampaign}
                id={campaign.id}
                text="Xóa đợt"
                label={`Xóa đợt ${campaign.title}`}
                confirm={`Xóa đợt “${campaign.title}”? Toàn bộ tiêu chí, minh chứng, lịch sử duyệt và tệp đính kèm sẽ bị xóa vĩnh viễn.`}
              />
              </>
              )}
            </>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card title="Tiêu chí" bodyClassName="py-2">
            <ul>
              <li>
                <a href={`/minh-chung/${id}`} className={cn("flex items-center justify-between px-5 py-2 text-sm hover:bg-slate-50", !tc && "font-semibold text-action")}>
                  Tất cả tiêu chí
                </a>
              </li>
              {campaign.criteria.map((c) => {
                const approved = c.evidences.some((e) => e.status === "APPROVED");
                return (
                  <li key={c.id}>
                    <a href={`/minh-chung/${id}?tc=${c.id}`} className={cn("flex items-start gap-2.5 px-5 py-2 text-sm hover:bg-slate-50", tc === c.id && "bg-brand-50")}>
                      {approved ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Đã có minh chứng được duyệt" />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" aria-label="Chưa có minh chứng được duyệt" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="font-mono text-xs font-semibold text-brand-700">{c.code}</span> <span className={cn(tc === c.id && "font-semibold")}>{c.title}</span>
                      </span>
                      <span className="text-xs text-ink-muted tabular-nums">{c.evidences.length}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>

        <div className="space-y-6">
          {open ? (
            <Card title="Nộp minh chứng">
              <ActionForm action={submitEvidence} className="grid gap-4 space-y-0 md:grid-cols-2">
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Field label="Tiêu chí" htmlFor="criterionId" required>
                  <select id="criterionId" name="criterionId" required defaultValue={tc ?? ""} className="input">
                    <option value="" disabled>
                      — Chọn tiêu chí —
                    </option>
                    {campaign.criteria.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tên minh chứng" htmlFor="title" required>
                  <input id="title" name="title" required className="input" placeholder="Biên bản họp tổ bộ môn tháng 9" />
                </Field>
                <Field label="Mô tả" htmlFor="description">
                  <textarea id="description" name="description" rows={3} className="input" />
                </Field>
                <Field label="Tệp minh chứng" htmlFor="files" hint="Bắt buộc. PDF, ảnh, Word, Excel… tối đa 20MB/tệp." required>
                  <input id="files" name="files" type="file" multiple required className="input" />
                </Field>
                <div className="md:col-span-2">
                  <SubmitButton>
                    <Upload className="size-4" aria-hidden /> Nộp minh chứng
                  </SubmitButton>
                </div>
              </ActionForm>
            </Card>
          ) : (
            <div className="card card-pad text-sm text-ink-muted">
              <Badge tone="slate">Đợt minh chứng không trong thời gian nhận hồ sơ</Badge>
            </div>
          )}

          <Card title={manager ? `Minh chứng đã nộp (${evidences.length})` : `Minh chứng của bạn (${evidences.length})`} bodyClassName="divide-y divide-line">
            {evidences.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-ink-muted">Chưa có minh chứng nào.</p>
            ) : (
              evidences.map((ev) => <EvidenceItem key={ev.id} ev={ev} canReview={canReviewEvidence(user, ev.status)} isOwner={ev.submitterId === user.id} />)
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

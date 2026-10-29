import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { toLocalInput } from "@/lib/utils";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DeleteButton } from "@/components/delete-button";
import { deleteCampaign, deleteCriterion, saveCriterion, updateCampaign } from "../../actions";

export const metadata = { title: "Sửa đợt minh chứng" };

export default async function EditCampaign({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("ADMIN");
  const campaign = await db.evidenceCampaign.findUnique({
    where: { id },
    include: { criteria: { orderBy: { order: "asc" }, include: { _count: { select: { evidences: true } } } }, _count: { select: { evidences: true } } },
  });
  if (!campaign) notFound();
  const day = (d: Date) => toLocalInput(d).slice(0, 10);

  return (
    <>
      <PageHeader
        title="Sửa đợt minh chứng"
        back={{ href: `/minh-chung/${campaign.id}`, label: campaign.title }}
        actions={
          <DeleteButton
            action={deleteCampaign}
            id={campaign.id}
            text="Xóa đợt"
            label={`Xóa đợt ${campaign.title}`}
            confirm={`Xóa đợt “${campaign.title}”? Toàn bộ ${campaign.criteria.length} tiêu chí, ${campaign._count.evidences} minh chứng, lịch sử duyệt và tệp đính kèm sẽ bị xóa vĩnh viễn.`}
          />
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Thông tin đợt">
          <ActionForm action={updateCampaign} resetOnSuccess={false}>
            <input type="hidden" name="id" value={campaign.id} />
            <Field label="Tên đợt" htmlFor="title" required>
              <input id="title" name="title" required defaultValue={campaign.title} className="input" />
            </Field>
            <Field label="Cơ quan yêu cầu" htmlFor="agency" required>
              <input id="agency" name="agency" required defaultValue={campaign.agency} className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngày mở" htmlFor="openAt" required>
                <input id="openAt" name="openAt" type="date" required defaultValue={day(campaign.openAt)} className="input" />
              </Field>
              <Field label="Hạn nộp" htmlFor="closeAt" required>
                <input id="closeAt" name="closeAt" type="date" required defaultValue={day(campaign.closeAt)} className="input" />
              </Field>
            </div>
            <Field label="Mô tả" htmlFor="description">
              <textarea id="description" name="description" rows={3} defaultValue={campaign.description ?? ""} className="input" />
            </Field>
            <SubmitButton>Lưu thông tin</SubmitButton>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card title={`Tiêu chí (${campaign.criteria.length})`} bodyClassName="divide-y divide-line">
            {campaign.criteria.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:px-6">
                <ActionForm action={saveCriterion} resetOnSuccess={false} className="flex flex-1 flex-col gap-2 space-y-0 sm:flex-row sm:items-start">
                  <input type="hidden" name="id" value={c.id} />
                  <label className="sr-only" htmlFor={`code-${c.id}`}>
                    Mã tiêu chí
                  </label>
                  <input id={`code-${c.id}`} name="code" required defaultValue={c.code} className="input font-mono sm:w-24" />
                  <label className="sr-only" htmlFor={`title-${c.id}`}>
                    Tên tiêu chí
                  </label>
                  <input id={`title-${c.id}`} name="title" required defaultValue={c.title} className="input flex-1" />
                  <SubmitButton className="btn btn-secondary" pendingText="…">
                    Lưu
                  </SubmitButton>
                </ActionForm>
                <div className="flex items-center gap-2 sm:pt-1">
                  {c._count.evidences > 0 && <Badge>{c._count.evidences} MC</Badge>}
                  <DeleteButton action={deleteCriterion} id={c.id} label={`Xóa tiêu chí ${c.code}`} confirm={`Xóa tiêu chí ${c.code} – ${c.title}?`} />
                </div>
              </div>
            ))}
          </Card>
          <Card title="Thêm tiêu chí">
            <ActionForm action={saveCriterion} className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-end">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <div className="sm:w-28">
                <label htmlFor="new-code" className="label">
                  Mã
                </label>
                <input id="new-code" name="code" required placeholder={`TC${campaign.criteria.length + 1}`} className="input font-mono" />
              </div>
              <div className="flex-1">
                <label htmlFor="new-title" className="label">
                  Tên tiêu chí
                </label>
                <input id="new-title" name="title" required className="input" />
              </div>
              <SubmitButton>Thêm</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { ClipboardCheck, CalendarClock, Building2, Pencil } from "lucide-react";
import { requireUser, isManager, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn, fmtDate, fmtRelative, toLocalInput } from "@/lib/utils";
import { Badge, EmptyState, Field, PageHeader, ProgressBar } from "@/components/ui";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { createCampaign, deleteCampaign } from "./actions";
import { DeleteButton } from "@/components/delete-button";

export const metadata = { title: "Minh chứng Sở ban ngành" };

export default async function CampaignsPage() {
  const user = await requireUser();
  const manager = isManager(user);
  const admin = isAdmin(user);
  const campaigns = await db.evidenceCampaign.findMany({
    orderBy: { closeAt: "desc" },
    include: {
      criteria: { select: { id: true } },
      evidences: { select: { status: true, criterionId: true, submitterId: true } },
    },
  });
  const now = new Date();
  const today = toLocalInput(now).slice(0, 10);

  return (
    <>
      <PageHeader
        title="Cổng nộp minh chứng"
        description="Các đợt thu thập minh chứng theo yêu cầu của Sở, Ban, Ngành. Minh chứng do Quản lý khoa phê duyệt; mỗi quyết định ghi rõ người duyệt, thời gian và được lưu cố định để xuất báo cáo."
      />

      {manager && (
        <Disclosure summary="Tạo đợt minh chứng mới" className="mb-6">
          <ActionForm action={createCampaign} resetOnSuccess={false} className="grid gap-4 space-y-0 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label="Tên đợt" htmlFor="title" required>
                <input id="title" name="title" required className="input" placeholder="Kiểm định chất lượng CTĐT năm 2026" />
              </Field>
              <Field label="Cơ quan yêu cầu" htmlFor="agency" required>
                <input id="agency" name="agency" required className="input" placeholder="Sở Lao động – Thương binh và Xã hội" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ngày mở" htmlFor="openAt" required>
                  <input id="openAt" name="openAt" type="date" required defaultValue={today} className="input" />
                </Field>
                <Field label="Hạn nộp" htmlFor="closeAt" required>
                  <input id="closeAt" name="closeAt" type="date" required className="input" />
                </Field>
              </div>
              <Field label="Mô tả" htmlFor="description">
                <textarea id="description" name="description" rows={3} className="input" />
              </Field>
            </div>
            <div className="flex flex-col gap-4">
              <Field label="Danh sách tiêu chí" htmlFor="criteria" hint="Mỗi dòng một tiêu chí, dạng “Mã | Tên tiêu chí”. Ví dụ: TC1.1 | Kế hoạch đào tạo năm học" required>
                <textarea id="criteria" name="criteria" required rows={9} className="input font-mono text-[13px]" placeholder={"TC1.1 | Kế hoạch đào tạo năm học\nTC1.2 | Biên bản họp tổ bộ môn\nTC2.1 | Hồ sơ giảng dạy của giảng viên"} />
              </Field>
              <div>
                <SubmitButton>Tạo đợt minh chứng</SubmitButton>
              </div>
            </div>
          </ActionForm>
        </Disclosure>
      )}

      {campaigns.length === 0 ? (
        <div className="card">
          <EmptyState icon={ClipboardCheck} title="Chưa có đợt minh chứng nào" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {campaigns.map((c) => {
            const open = c.openAt <= now && c.closeAt >= now;
            const covered = new Set(c.evidences.filter((e) => e.status === "APPROVED").map((e) => e.criterionId)).size;
            const pending = c.evidences.filter((e) => e.status === "SUBMITTED" || e.status === "ASSISTANT_APPROVED").length;
            const mine = c.evidences.filter((e) => e.submitterId === user.id).length;
            const pct = (covered / Math.max(1, c.criteria.length)) * 100;
            return (
              <div key={c.id} className="card flex flex-col transition-shadow duration-200 hover:shadow-md">
              <Link href={`/minh-chung/${c.id}`} className="card-pad flex flex-1 flex-col gap-4 rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-ink text-balance">{c.title}</h2>
                  {open ? <Badge tone="green">Đang mở</Badge> : c.closeAt < now ? <Badge tone="slate">Đã đóng</Badge> : <Badge tone="blue">Sắp mở</Badge>}
                </div>
                <div className="space-y-1.5 text-sm text-ink-muted">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 shrink-0" aria-hidden /> {c.agency}
                  </div>
                  <div className={cn("flex items-center gap-2", open && c.closeAt.getTime() - now.getTime() < 7 * 86_400_000 && "font-medium text-amber-700")}>
                    <CalendarClock className="size-4 shrink-0" aria-hidden /> Hạn {fmtDate(c.closeAt)} {open && `(${fmtRelative(c.closeAt)})`}
                  </div>
                </div>
                <div className="mt-auto">
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-ink-muted">Tiêu chí đã có minh chứng duyệt</span>
                    <span className="font-medium tabular-nums">
                      {covered}/{c.criteria.length}
                    </span>
                  </div>
                  <ProgressBar value={pct} tone={pct >= 100 ? "green" : "blue"} label="Tỷ lệ tiêu chí đã đạt" />
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge tone="slate">{c.evidences.length} minh chứng</Badge>
                    {pending > 0 && <Badge tone="amber">{pending} chờ duyệt</Badge>}
                    {mine > 0 && <Badge tone="blue">Bạn đã nộp {mine}</Badge>}
                  </div>
                </div>
              </Link>
              {admin && (
                <div className="flex items-start justify-end gap-1 border-t border-line px-4 py-2">
                  <Link href={`/minh-chung/${c.id}/sua`} className="btn btn-ghost btn-sm">
                    <Pencil className="size-4" aria-hidden /> Sửa
                  </Link>
                  <DeleteButton
                    action={deleteCampaign}
                    id={c.id}
                    label={`Xóa đợt ${c.title}`}
                    confirm={`Xóa đợt “${c.title}”? Toàn bộ ${c.criteria.length} tiêu chí, ${c.evidences.length} minh chứng, lịch sử duyệt và tệp đính kèm sẽ bị xóa vĩnh viễn.`}
                  />
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

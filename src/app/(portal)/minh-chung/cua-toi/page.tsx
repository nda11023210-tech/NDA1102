import { FolderOpen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EVIDENCE_STATUS } from "@/lib/constants";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { EvidenceItem, evidenceInclude } from "../evidence-item";

export const metadata = { title: "Minh chứng của tôi" };

export default async function MyEvidence() {
  const user = await requireUser();
  const evidences = await db.evidence.findMany({
    where: { submitterId: user.id },
    include: evidenceInclude,
    orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
  });
  const counts = Object.keys(EVIDENCE_STATUS).map((s) => [s, evidences.filter((e) => e.status === s).length] as const);

  return (
    <>
      <PageHeader title="Minh chứng của tôi" description="Toàn bộ minh chứng bạn đã nộp qua các đợt, kèm trạng thái và lịch sử duyệt." />
      <div className="mb-4 flex flex-wrap gap-2">
        {counts.map(([s, n]) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-sm">
            <StatusBadge map={EVIDENCE_STATUS} value={s} /> <span className="font-semibold tabular-nums">{n}</span>
          </span>
        ))}
      </div>
      <Card bodyClassName="divide-y divide-line">
        {evidences.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Bạn chưa nộp minh chứng nào" />
        ) : (
          evidences.map((ev) => <EvidenceItem key={ev.id} ev={ev} canReview={false} isOwner showCampaign />)
        )}
      </Card>
    </>
  );
}

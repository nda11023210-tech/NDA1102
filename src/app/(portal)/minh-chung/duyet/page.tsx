import { Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReviewEvidence, reviewQueueStatuses } from "@/lib/permissions";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { EvidenceItem, evidenceInclude } from "../evidence-item";

export const metadata = { title: "Hàng chờ duyệt minh chứng" };

export default async function ReviewQueue() {
  const user = await requireRole("MANAGER");
  const evidences = await db.evidence.findMany({
    where: { status: { in: reviewQueueStatuses(user) } },
    include: evidenceInclude,
    orderBy: { updatedAt: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Hàng chờ duyệt"
        description="Hồ sơ đang chờ Quản lý khoa phê duyệt. Một lần duyệt là hoàn tất; trả hồ sơ thì giảng viên bổ sung và nộp lại. Tên người duyệt được ghi vào lịch sử, không thể sửa."
      />
      <Card bodyClassName="divide-y divide-line">
        {evidences.length === 0 ? (
          <EmptyState icon={Inbox} title="Không còn hồ sơ chờ duyệt">
            Tuyệt vời! Mọi minh chứng đã được xử lý.
          </EmptyState>
        ) : (
          evidences.map((ev) => <EvidenceItem key={ev.id} ev={ev} canReview={canReviewEvidence(user, ev.status)} isOwner={false} showCampaign />)
        )}
      </Card>
    </>
  );
}

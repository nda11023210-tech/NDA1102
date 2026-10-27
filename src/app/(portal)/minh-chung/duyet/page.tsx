import { Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReviewEvidence, reviewQueueStatuses } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/constants";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { EvidenceItem, evidenceInclude } from "../evidence-item";

export const metadata = { title: "Hàng chờ duyệt minh chứng" };

export default async function ReviewQueue() {
  const user = await requireRole("HEAD", "ASSISTANT");
  const evidences = await db.evidence.findMany({
    where: { status: { in: reviewQueueStatuses(user) } },
    include: evidenceInclude,
    orderBy: { updatedAt: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Hàng chờ duyệt"
        description={`Hồ sơ đang chờ ${ROLE_LABEL[user.role]} xử lý. Duyệt xong, hồ sơ tự động chuyển sang bước tiếp theo; trả hồ sơ sẽ thông báo cho giảng viên bổ sung.`}
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

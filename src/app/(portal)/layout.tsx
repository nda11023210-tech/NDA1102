import { Sidebar } from "@/components/sidebar";
import { requireUser, isManager, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { logoutAction } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const manager = isManager(user);

  const [docs, loans, evidence, tasks] = await Promise.all([
    // Văn bản bắt buộc ký nhận mà người dùng chưa ký
    db.document.count({
      where: { requireSign: true, NOT: { receipts: { some: { userId: user.id, signedAt: { not: null } } } } },
    }),
    manager ? db.assetLoan.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    hasRole(user, "ASSISTANT")
      ? db.evidence.count({ where: { status: user.role === "ADMIN" ? { in: ["SUBMITTED", "ASSISTANT_APPROVED"] } : "SUBMITTED" } })
      : hasRole(user, "HEAD")
        ? db.evidence.count({ where: { status: "ASSISTANT_APPROVED" } })
        : db.evidence.count({ where: { submitterId: user.id, status: "REJECTED" } }),
    db.task.count({ where: { assigneeId: user.id, status: { in: ["TODO", "IN_PROGRESS", "REVISION"] } } }),
  ]);

  return (
    <div className="min-h-dvh">
      <Sidebar user={user} badges={{ docs, loans, evidence, tasks }} logout={logoutAction} />
      <div className="lg:pl-[264px]">
        <main id="main" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

import Link from "next/link";
import { HandHelping, Check, X, Undo2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { LOAN_STATUS } from "@/lib/constants";
import { cn, fmtDateTime, fmtRelative } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { decideLoan } from "../actions";

export const metadata = { title: "Mượn / Trả thiết bị" };

export default async function LoansPage() {
  const user = await requireUser();
  const manager = isManager(user);
  const scope: Prisma.AssetLoanWhereInput = manager ? {} : { borrowerId: user.id };
  const include = { asset: true, borrower: true } as const;

  const [pending, active, history] = await Promise.all([
    db.assetLoan.findMany({ where: { ...scope, status: "PENDING" }, include, orderBy: { startAt: "asc" } }),
    db.assetLoan.findMany({ where: { ...scope, status: "APPROVED" }, include, orderBy: { dueAt: "asc" } }),
    db.assetLoan.findMany({ where: { ...scope, status: { in: ["RETURNED", "REJECTED"] } }, include, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const now = new Date();

  const Row = ({ l, actions }: { l: (typeof pending)[number]; actions?: React.ReactNode }) => {
    const late = l.status === "APPROVED" && l.dueAt < now;
    return (
      <div className={cn("flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center", late && "bg-red-50/50")}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/tai-san/${l.asset.code}`} className="font-mono text-[13px] font-semibold text-action hover:underline">
              {l.asset.code}
            </Link>
            <span className="font-medium">{l.asset.name}</span>
            <StatusBadge map={LOAN_STATUS} value={l.status} />
            {late && <Badge tone="red">Quá hạn trả {fmtRelative(l.dueAt)}</Badge>}
          </div>
          <div className="mt-1 text-sm text-ink-muted">
            {manager && <span className="font-medium text-ink-soft">{l.borrower.name} · </span>}
            {l.purpose}
          </div>
          <div className="mt-0.5 text-xs text-ink-muted tabular-nums">
            {fmtDateTime(l.startAt)} → {fmtDateTime(l.dueAt)}
            {l.returnedAt && ` · Đã trả ${fmtDateTime(l.returnedAt)}`}
            {l.returnNote && ` · ${l.returnNote}`}
          </div>
        </div>
        {actions}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Mượn / Trả thiết bị"
        description={manager ? "Duyệt yêu cầu mượn và xác nhận trả thiết bị. Thiết bị trả về có hư hỏng sẽ tự chuyển sang trạng thái Bảo trì." : "Theo dõi các yêu cầu mượn của bạn. Để mượn, mở trang thiết bị (hoặc quét mã QR) và gửi yêu cầu."}
        actions={
          <Link href="/tai-san?st=AVAILABLE" className="btn btn-primary">
            <HandHelping className="size-4" aria-hidden /> Tìm thiết bị để mượn
          </Link>
        }
      />
      <div className="space-y-6">
        <Card title={`Chờ duyệt (${pending.length})`} bodyClassName="divide-y divide-line">
          {pending.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-ink-muted">Không có yêu cầu nào đang chờ.</p>
          ) : (
            pending.map((l) => (
              <Row
                key={l.id}
                l={l}
                actions={
                  manager && (
                    <form action={decideLoan} className="flex shrink-0 gap-2">
                      <input type="hidden" name="id" value={l.id} />
                      <SubmitButton className="btn btn-success btn-sm" name="decision" value="approve">
                        <Check className="size-4" aria-hidden /> Duyệt
                      </SubmitButton>
                      <SubmitButton className="btn btn-danger-soft btn-sm" name="decision" value="reject">
                        <X className="size-4" aria-hidden /> Từ chối
                      </SubmitButton>
                    </form>
                  )
                }
              />
            ))
          )}
        </Card>

        <Card title={`Đang mượn (${active.length})`} bodyClassName="divide-y divide-line">
          {active.length === 0 ? (
            <EmptyState icon={HandHelping} title="Không có thiết bị đang được mượn" />
          ) : (
            active.map((l) => (
              <Row
                key={l.id}
                l={l}
                actions={
                  manager && (
                    <form action={decideLoan} className="flex shrink-0 flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={l.id} />
                      <label htmlFor={`cond-${l.id}`} className="sr-only">
                        Tình trạng khi trả
                      </label>
                      <select id={`cond-${l.id}`} name="condition" className="input min-h-8 w-36 py-1">
                        <option value="GOOD">Bình thường</option>
                        <option value="DAMAGED">Có hư hỏng</option>
                      </select>
                      <label htmlFor={`note-${l.id}`} className="sr-only">
                        Ghi chú khi trả
                      </label>
                      <input id={`note-${l.id}`} name="returnNote" placeholder="Ghi chú" className="input min-h-8 w-40 py-1" />
                      <SubmitButton className="btn btn-secondary btn-sm" name="decision" value="return">
                        <Undo2 className="size-4" aria-hidden /> Xác nhận trả
                      </SubmitButton>
                    </form>
                  )
                }
              />
            ))
          )}
        </Card>

        <Card title="Lịch sử gần đây" bodyClassName="divide-y divide-line">
          {history.length === 0 ? <p className="px-6 py-8 text-center text-sm text-ink-muted">Chưa có lịch sử.</p> : history.map((l) => <Row key={l.id} l={l} />)}
        </Card>
      </div>
    </>
  );
}

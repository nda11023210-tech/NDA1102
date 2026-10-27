import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { ASSET_CATEGORY, INVENTORY_CONDITION } from "@/lib/constants";
import { fmtDateTime } from "@/lib/utils";
import { Badge, Card, PageHeader, ProgressBar, StatCard, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { CheckCircle2, AlertTriangle, HelpCircle, CircleDashed } from "lucide-react";
import { closeInventoryCheck } from "../../actions";

export const metadata = { title: "Đợt kiểm kê" };

export default async function InventoryCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const check = await db.inventoryCheck.findUnique({
    where: { id },
    include: { createdBy: true, items: { include: { asset: true, checkedBy: true }, orderBy: { checkedAt: "desc" } } },
  });
  if (!check) notFound();
  const checkedIds = new Set(check.items.map((i) => i.assetId));
  const pending = await db.asset.findMany({
    where: { status: { not: "LIQUIDATED" }, id: { notIn: [...checkedIds] } },
    orderBy: [{ location: "asc" }, { code: "asc" }],
  });
  const total = check.items.length + pending.length;
  const n = (c: string) => check.items.filter((i) => i.condition === c).length;

  return (
    <>
      <PageHeader
        title={check.name}
        back={{ href: "/tai-san/kiem-ke", label: "Kiểm kê" }}
        description={`Mở bởi ${check.createdBy.name} lúc ${fmtDateTime(check.startedAt)}${check.closedAt ? ` · Kết thúc ${fmtDateTime(check.closedAt)}` : ""}`}
        actions={
          !check.closedAt &&
          isManager(user) && (
            <form action={closeInventoryCheck}>
              <input type="hidden" name="id" value={check.id} />
              <SubmitButton className="btn btn-brand" confirm={pending.length ? `Còn ${pending.length} thiết bị chưa kiểm kê. Vẫn kết thúc đợt?` : undefined}>
                <Lock className="size-4" aria-hidden /> Kết thúc đợt kiểm kê
              </SubmitButton>
            </form>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Tình trạng tốt" value={n("GOOD")} tone="green" />
        <StatCard icon={AlertTriangle} label="Hư hỏng" value={n("DAMAGED")} tone="amber" />
        <StatCard icon={HelpCircle} label="Thất lạc" value={n("MISSING")} tone="red" />
        <StatCard icon={CircleDashed} label="Chưa kiểm kê" value={pending.length} tone="slate" />
      </div>
      <div className="card card-pad mb-6">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">Tiến độ</span>
          <span className="text-ink-muted tabular-nums">
            {check.items.length}/{total} thiết bị
          </span>
        </div>
        <ProgressBar value={(check.items.length / Math.max(1, total)) * 100} label="Tiến độ kiểm kê" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Chưa kiểm kê (${pending.length})`} bodyClassName="max-h-[560px] divide-y divide-line overflow-auto">
          {pending.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-emerald-700">Đã kiểm kê toàn bộ thiết bị.</p>
          ) : (
            pending.map((a) => (
              <Link key={a.id} href={`/tai-san/${a.code}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50 sm:px-6">
                <div className="min-w-0">
                  <span className="font-mono font-semibold text-action">{a.code}</span> <span className="font-medium">{a.name}</span>
                  <div className="text-xs text-ink-muted">
                    {ASSET_CATEGORY[a.category]} · {a.location}
                  </div>
                </div>
                {!check.closedAt && <Badge tone="blue">Kiểm kê</Badge>}
              </Link>
            ))
          )}
        </Card>
        <Card title={`Đã ghi nhận (${check.items.length})`} bodyClassName="max-h-[560px] divide-y divide-line overflow-auto">
          {check.items.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
              <div className="min-w-0">
                <Link href={`/tai-san/${i.asset.code}`} className="font-mono font-semibold text-action hover:underline">
                  {i.asset.code}
                </Link>{" "}
                <span className="font-medium">{i.asset.name}</span>
                <div className="text-xs text-ink-muted">
                  {i.checkedBy.name} · {fmtDateTime(i.checkedAt)}
                  {i.note && ` · ${i.note}`}
                </div>
              </div>
              <StatusBadge map={INVENTORY_CONDITION} value={i.condition} />
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

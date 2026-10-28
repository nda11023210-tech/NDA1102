import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import { Badge, Card, EmptyState, Field, PageHeader, ProgressBar } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { QrScanner } from "@/components/qr-scanner";
import { createInventoryCheck } from "../actions";

export const metadata = { title: "Kiểm kê thiết bị" };

export default async function InventoryPage() {
  const user = await requireUser();
  const manager = isManager(user);
  const [checks, assetTotal] = await Promise.all([
    db.inventoryCheck.findMany({
      orderBy: { startedAt: "desc" },
      include: { createdBy: true, items: { select: { condition: true } } },
    }),
    db.asset.count({ where: { status: { not: "LIQUIDATED" } } }),
  ]);
  const open = checks.find((c) => !c.closedAt);

  return (
    <>
      <PageHeader
        title="Kiểm kê định kỳ bằng QR"
        description="Mở đợt kiểm kê, sau đó quét mã QR dán trên từng thiết bị để ghi nhận tình trạng. Hệ thống tổng hợp thiết bị còn thiếu, hư hỏng, thất lạc."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card title="Các đợt kiểm kê" bodyClassName="divide-y divide-line">
          {checks.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Chưa có đợt kiểm kê" />
          ) : (
            checks.map((c) => {
              const done = c.items.length;
              const issues = c.items.filter((i) => i.condition !== "GOOD").length;
              return (
                <Link key={c.id} href={`/tai-san/kiem-ke/${c.id}`} className="block px-5 py-4 transition-colors hover:bg-slate-50 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{c.name}</div>
                    {c.closedAt ? <Badge tone="slate">Đã kết thúc {fmtDate(c.closedAt)}</Badge> : <Badge tone="blue">Đang kiểm kê</Badge>}
                  </div>
                  <div className="mt-1 text-sm text-ink-muted">
                    Bắt đầu {fmtDate(c.startedAt)} · {c.createdBy.name}
                    {issues > 0 && <span className="text-amber-700"> · {issues} thiết bị có vấn đề</span>}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar value={(done / Math.max(1, assetTotal)) * 100} tone={c.closedAt ? "green" : "blue"} label="Tiến độ kiểm kê" />
                    <span className="shrink-0 text-sm text-ink-muted tabular-nums">
                      {done}/{assetTotal}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </Card>

        <div className="space-y-6">
          {open && manager && (
            <Card title="Quét mã QR">
              <QrScanner />
            </Card>
          )}
          {manager && !open && (
            <Card title="Mở đợt kiểm kê mới">
              <ActionForm action={createInventoryCheck}>
                <Field label="Tên đợt" htmlFor="name" required>
                  <input id="name" name="name" required className="input" placeholder={`Kiểm kê cuối năm ${new Date().getFullYear()}`} />
                </Field>
                <SubmitButton>Bắt đầu kiểm kê</SubmitButton>
              </ActionForm>
            </Card>
          )}
          {!manager && (
            <Card>
              <p className="text-sm text-ink-muted">Kiểm kê do Quản lý khoa thực hiện. Bạn có thể xem kết quả các đợt kiểm kê tại đây.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

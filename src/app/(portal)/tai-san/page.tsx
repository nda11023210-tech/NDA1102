import Link from "next/link";
import { Boxes, CheckCircle2, Wrench, HandHelping, Printer, Search, AlertTriangle } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser, isManager, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ASSET_CATEGORY, ASSET_STATUS } from "@/lib/constants";
import { cn, fmtMoney } from "@/lib/utils";
import { Card, EmptyState, Field, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { createAsset, deleteAsset } from "./actions";
import { DeleteButton } from "@/components/delete-button";
import { Pencil } from "lucide-react";

export const metadata = { title: "Trang thiết bị" };

type SP = { cat?: string; st?: string; q?: string };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const manager = isManager(user);
  const admin = isAdmin(user);
  const sp = await searchParams;

  const where: Prisma.AssetWhereInput = {};
  if (sp.cat) where.category = sp.cat;
  if (sp.st) where.status = sp.st;
  if (sp.q) where.OR = [{ code: { contains: sp.q } }, { name: { contains: sp.q } }, { location: { contains: sp.q } }, { serial: { contains: sp.q } }];

  const [assets, byStatus, totalValue] = await Promise.all([
    db.asset.findMany({ where, orderBy: [{ category: "asc" }, { code: "asc" }] }),
    db.asset.groupBy({ by: ["status"], _count: true }),
    db.asset.aggregate({ _sum: { value: true }, where: { status: { not: "LIQUIDATED" } } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const total = byStatus.reduce((a, b) => a + b._count, 0);

  return (
    <>
      <PageHeader
        title="Trang thiết bị"
        description="Số hóa danh mục phòng thực hành, máy chiếu, thiết bị dạy học của Khoa. Mỗi thiết bị có mã QR để tra cứu, mượn và kiểm kê nhanh."
        actions={
          manager && (
            <Link href="/tai-san/in-tem" className="btn btn-secondary">
              <Printer className="size-4" aria-hidden /> In tem QR
            </Link>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Boxes} label="Tổng thiết bị" value={total} hint={`Nguyên giá ${fmtMoney(totalValue._sum.value ?? 0)}`} />
        <StatCard icon={CheckCircle2} label="Sẵn sàng sử dụng" value={count("AVAILABLE")} tone="green" href="/tai-san?st=AVAILABLE" />
        <StatCard icon={HandHelping} label="Đang cho mượn" value={count("BORROWED")} tone="violet" href="/tai-san?st=BORROWED" />
        <StatCard
          icon={count("BROKEN") > 0 ? AlertTriangle : Wrench}
          label="Tình trạng"
          value={count("MAINTENANCE") + count("BROKEN")}
          tone="amber"
          href="/tai-san?st=BROKEN"
        />
      </div>

      {manager && (
        <Disclosure summary="Thêm trang thiết bị" className="mb-6">
          <ActionForm action={createAsset} className="grid gap-4 space-y-0 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Mã thiết bị" htmlFor="code" hint="In trên tem QR, ví dụ MC-012" required>
              <input id="code" name="code" required className="input uppercase" />
            </Field>
            <Field label="Tên thiết bị" htmlFor="name" required>
              <input id="name" name="name" required className="input" />
            </Field>
            <Field label="Loại" htmlFor="category" required>
              <select id="category" name="category" className="input">
                {Object.entries(ASSET_CATEGORY).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vị trí" htmlFor="location">
              <input id="location" name="location" className="input" placeholder="Phòng A3.201" />
            </Field>
            <Field label="Số serial" htmlFor="serial">
              <input id="serial" name="serial" className="input" />
            </Field>
            <Field label="Ngày mua" htmlFor="purchaseDate">
              <input id="purchaseDate" name="purchaseDate" type="date" className="input" />
            </Field>
            <Field label="Nguyên giá (VNĐ)" htmlFor="value">
              <input id="value" name="value" inputMode="numeric" className="input" />
            </Field>
            <Field label="Ghi chú" htmlFor="note">
              <input id="note" name="note" className="input" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <SubmitButton>Thêm trang thiết bị</SubmitButton>
            </div>
          </ActionForm>
        </Disclosure>
      )}

      <Card bodyClassName="">
        <form action="/tai-san" className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:px-6">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <label htmlFor="asset-q" className="sr-only">
              Tìm thiết bị
            </label>
            <input id="asset-q" name="q" defaultValue={sp.q} placeholder="Tìm theo mã, tên, vị trí, serial…" className="input pl-9" />
          </div>
          <label htmlFor="asset-cat" className="sr-only">
            Loại thiết bị
          </label>
          <select id="asset-cat" name="cat" defaultValue={sp.cat ?? ""} className="input sm:w-52">
            <option value="">Tất cả loại</option>
            {Object.entries(ASSET_CATEGORY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <label htmlFor="asset-st" className="sr-only">
            Trạng thái
          </label>
          <select id="asset-st" name="st" defaultValue={sp.st ?? ""} className="input sm:w-44">
            <option value="">Mọi trạng thái</option>
            {Object.entries(ASSET_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary">Lọc</button>
        </form>
        {assets.length === 0 ? (
          <EmptyState icon={Boxes} title="Không tìm thấy thiết bị" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[900px]">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên thiết bị</th>
                  <th>Loại</th>
                  <th>Vị trí</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Nguyên giá</th>
                  {admin && <th className="text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className={cn(a.status === "LIQUIDATED" && "opacity-60")}>
                    <td>
                      <Link href={`/tai-san/${a.code}`} className="font-mono text-[13px] font-semibold text-action hover:underline">
                        {a.code}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/tai-san/${a.code}`} className="font-medium hover:text-action">
                        {a.name}
                      </Link>
                    </td>
                    <td className="text-ink-muted">{ASSET_CATEGORY[a.category] ?? a.category}</td>
                    <td className="text-ink-muted">{a.location}</td>
                    <td>
                      <StatusBadge map={ASSET_STATUS} value={a.status} />
                    </td>
                    <td className="text-right text-ink-muted tabular-nums">{fmtMoney(a.value)}</td>
                    {admin && (
                      <td>
                        <div className="flex items-start justify-end gap-1">
                          <Link href={`/tai-san/${a.code}#sua`} className="btn btn-ghost btn-sm" aria-label={`Sửa thiết bị ${a.code}`}>
                            <Pencil className="size-4" aria-hidden /> Sửa
                          </Link>
                          <DeleteButton
                            action={deleteAsset}
                            id={a.id}
                            label={`Xóa thiết bị ${a.code}`}
                            confirm={`Xóa thiết bị ${a.code} – ${a.name}? Lịch sử mượn/trả và kiểm kê của thiết bị cũng bị xóa.`}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

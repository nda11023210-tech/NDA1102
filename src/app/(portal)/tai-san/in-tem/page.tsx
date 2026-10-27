import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { assetQrSvg } from "@/lib/qr";
import { ASSET_CATEGORY, FACULTY_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "In tem QR" };

export default async function PrintLabels({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  await requireRole("HEAD", "ASSISTANT");
  const { cat } = await searchParams;
  const assets = await db.asset.findMany({
    where: { status: { not: "LIQUIDATED" }, ...(cat ? { category: cat } : {}) },
    orderBy: { code: "asc" },
  });
  const labels = await Promise.all(assets.map(async (a) => ({ ...a, svg: await assetQrSvg(a.code) })));

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="In tem QR tài sản"
          back={{ href: "/tai-san", label: "Danh mục tài sản" }}
          description={`${labels.length} tem. In trên giấy decal A4, cắt và dán lên thiết bị.`}
          actions={
            <>
              <form className="flex gap-2">
                <label htmlFor="print-cat" className="sr-only">
                  Loại tài sản
                </label>
                <select id="print-cat" name="cat" defaultValue={cat ?? ""} className="input w-auto">
                  <option value="">Tất cả loại</option>
                  {Object.entries(ASSET_CATEGORY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary">Lọc</button>
              </form>
              <PrintButton />
            </>
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
        {labels.map((a) => (
          <div key={a.id} className="flex break-inside-avoid items-center gap-2 rounded-lg border border-dashed border-slate-400 bg-white p-2.5">
            <div className="w-[84px] shrink-0" dangerouslySetInnerHTML={{ __html: a.svg }} />
            <div className="min-w-0 text-[11px] leading-tight">
              <div className="font-mono text-[13px] font-bold">{a.code}</div>
              <div className="mt-0.5 line-clamp-2 font-medium">{a.name}</div>
              <div className="mt-1 text-slate-500">{FACULTY_NAME}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

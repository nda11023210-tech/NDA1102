import { notFound } from "next/navigation";
import { ScanLine } from "lucide-react";
import { requireUser, isManager, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { assetQrSvg } from "@/lib/qr";
import { ASSET_CATEGORY, ASSET_STATUS, INVENTORY_CONDITION, LOAN_STATUS } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtMoney, toLocalInput } from "@/lib/utils";
import { Badge, Card, Field, PageHeader, StatusBadge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { deleteAsset, recordInventory, requestLoan, updateAsset } from "../actions";
import { DeleteButton } from "@/components/delete-button";

export const metadata = { title: "Chi tiết thiết bị" };

export default async function AssetDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser();
  const manager = isManager(user);
  const admin = isAdmin(user);
  const asset = await db.asset.findUnique({
    where: { code: decodeURIComponent(code).toUpperCase() },
    include: {
      loans: { orderBy: { createdAt: "desc" }, take: 15, include: { borrower: true } },
      inventoryItems: { orderBy: { checkedAt: "desc" }, take: 5, include: { check: true, checkedBy: true } },
    },
  });
  if (!asset) notFound();

  const [qr, openCheck] = await Promise.all([assetQrSvg(asset.code), manager ? db.inventoryCheck.findFirst({ where: { closedAt: null } }) : null]);
  const checkedInOpen = openCheck ? asset.inventoryItems.find((i) => i.checkId === openCheck.id) : undefined;

  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const due = new Date(start.getTime() + 4 * 3_600_000);

  return (
    <>
      <PageHeader
        title={asset.name}
        back={{ href: "/tai-san", label: "Danh mục thiết bị" }}
        actions={
          admin && (
            <DeleteButton
              action={deleteAsset}
              id={asset.id}
              fields={{ from: "detail" }}
              text="Xóa thiết bị"
              label={`Xóa thiết bị ${asset.code}`}
              confirm={`Xóa thiết bị ${asset.code} – ${asset.name}? Toàn bộ lịch sử mượn/trả và kiểm kê của thiết bị cũng bị xóa. Nếu chỉ ngừng sử dụng, nên chuyển trạng thái sang “Thanh lý”.`}
            />
          )
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-ink">{asset.code}</span>
            <span aria-hidden>·</span>
            {ASSET_CATEGORY[asset.category]}
            <span aria-hidden>·</span>
            <StatusBadge map={ASSET_STATUS} value={asset.status} />
          </span>
        }
      />

      {openCheck && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-action text-white">
                <ScanLine className="size-5" aria-hidden />
              </div>
              <div>
                <div className="font-semibold">Kiểm kê: {openCheck.name}</div>
                <div className="text-sm text-ink-muted">
                  {checkedInOpen
                    ? `Đã ghi nhận “${INVENTORY_CONDITION[checkedInOpen.condition].label}” lúc ${fmtDateTime(checkedInOpen.checkedAt)}. Có thể ghi đè.`
                    : "Thiết bị này chưa được kiểm kê trong đợt hiện tại."}
                </div>
              </div>
            </div>
            <ActionForm action={recordInventory} resetOnSuccess={false} className="flex flex-1 flex-col gap-2 space-y-0 sm:flex-row sm:items-center lg:justify-end">
              <input type="hidden" name="checkId" value={openCheck.id} />
              <input type="hidden" name="assetId" value={asset.id} />
              <fieldset className="flex gap-1.5">
                <legend className="sr-only">Tình trạng</legend>
                {Object.entries(INVENTORY_CONDITION).map(([k, v]) => (
                  <label key={k} className="cursor-pointer">
                    <input type="radio" name="condition" value={k} defaultChecked={(checkedInOpen?.condition ?? "GOOD") === k} className="peer sr-only" />
                    <span className="inline-flex min-h-10 items-center rounded-lg border border-line-strong bg-white px-3 text-sm font-medium peer-checked:border-action peer-checked:bg-action peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300">
                      {v.label}
                    </span>
                  </label>
                ))}
              </fieldset>
              <label htmlFor="inv-note" className="sr-only">
                Ghi chú kiểm kê
              </label>
              <input id="inv-note" name="note" placeholder="Ghi chú (nếu có)" className="input sm:w-56" defaultValue={checkedInOpen?.note ?? ""} />
              <SubmitButton>Ghi nhận</SubmitButton>
            </ActionForm>
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card title="Thông tin thiết bị">
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              {[
                ["Mã thiết bị", <span key="c" className="font-mono">{asset.code}</span>],
                ["Loại", ASSET_CATEGORY[asset.category]],
                ["Vị trí", asset.location],
                ["Số serial", asset.serial ?? "—"],
                ["Ngày mua", fmtDate(asset.purchaseDate)],
                ["Nguyên giá", fmtMoney(asset.value)],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3 border-b border-dashed border-line pb-2">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {asset.note && <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-soft">{asset.note}</p>}
          </Card>

          <Card title="Lịch sử mượn / trả" bodyClassName="overflow-x-auto">
            {asset.loans.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-ink-muted">Chưa có lượt mượn nào.</p>
            ) : (
              <table className="table min-w-[600px]">
                <thead>
                  <tr>
                    <th>Người mượn</th>
                    <th>Mục đích</th>
                    <th>Thời gian</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {asset.loans.map((l) => (
                    <tr key={l.id}>
                      <td className="font-medium">{l.borrower.name}</td>
                      <td className="text-ink-muted">{l.purpose}</td>
                      <td className="text-ink-muted tabular-nums">
                        {fmtDateTime(l.startAt)} → {fmtDateTime(l.dueAt)}
                      </td>
                      <td>
                        <StatusBadge map={LOAN_STATUS} value={l.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {asset.inventoryItems.length > 0 && (
            <Card title="Lịch sử kiểm kê" bodyClassName="divide-y divide-line">
              {asset.inventoryItems.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm sm:px-6">
                  <div>
                    <div className="font-medium">{i.check.name}</div>
                    <div className="text-ink-muted">
                      {i.checkedBy.name} · {fmtDateTime(i.checkedAt)}
                      {i.note ? ` · ${i.note}` : ""}
                    </div>
                  </div>
                  <StatusBadge map={INVENTORY_CONDITION} value={i.condition} />
                </div>
              ))}
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card title="Mã QR">
            <div className="mx-auto w-48 rounded-lg border border-line p-2" dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label={`Mã QR của ${asset.code}`} />
            <p className="mt-3 text-center text-xs text-ink-muted">Quét bằng camera điện thoại để mở trang này.</p>
          </Card>

          {asset.status === "AVAILABLE" ? (
            <Card title="Đăng ký mượn">
              <ActionForm action={requestLoan}>
                <input type="hidden" name="assetId" value={asset.id} />
                <Field label="Mục đích" htmlFor="purpose" required>
                  <input id="purpose" name="purpose" required className="input" placeholder="Dạy lớp CNTT-K24A, phòng A2.105" />
                </Field>
                <Field label="Từ" htmlFor="startAt" required>
                  <input id="startAt" name="startAt" type="datetime-local" required defaultValue={toLocalInput(start)} className="input" />
                </Field>
                <Field label="Đến" htmlFor="dueAt" required>
                  <input id="dueAt" name="dueAt" type="datetime-local" required defaultValue={toLocalInput(due)} className="input" />
                </Field>
                <SubmitButton className="btn btn-primary w-full">Gửi yêu cầu mượn</SubmitButton>
              </ActionForm>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-ink-muted">
                Thiết bị đang ở trạng thái <Badge tone={ASSET_STATUS[asset.status].tone}>{ASSET_STATUS[asset.status].label}</Badge>, tạm thời không nhận yêu cầu mượn.
              </p>
            </Card>
          )}

          {admin && (
            <Card title={<span id="sua" className="scroll-mt-6">Sửa thông tin thiết bị</span>}>
              <ActionForm action={updateAsset} resetOnSuccess={false}>
                <input type="hidden" name="id" value={asset.id} />
                <Field label="Mã thiết bị" htmlFor="code" hint="Đổi mã thì cần in lại tem QR." required>
                  <input id="code" name="code" required defaultValue={asset.code} className="input uppercase" />
                </Field>
                <Field label="Tên thiết bị" htmlFor="name" required>
                  <input id="name" name="name" required defaultValue={asset.name} className="input" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Loại" htmlFor="category">
                    <select id="category" name="category" defaultValue={asset.category} className="input">
                      {Object.entries(ASSET_CATEGORY).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Trạng thái" htmlFor="status">
                    <select id="status" name="status" defaultValue={asset.status} className="input">
                      {Object.entries(ASSET_STATUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Vị trí" htmlFor="location">
                  <input id="location" name="location" defaultValue={asset.location} className="input" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Số serial" htmlFor="serial">
                    <input id="serial" name="serial" defaultValue={asset.serial ?? ""} className="input" />
                  </Field>
                  <Field label="Ngày mua" htmlFor="purchaseDate">
                    <input id="purchaseDate" name="purchaseDate" type="date" defaultValue={asset.purchaseDate ? toLocalInput(asset.purchaseDate).slice(0, 10) : ""} className="input" />
                  </Field>
                </div>
                <Field label="Nguyên giá (VNĐ)" htmlFor="value">
                  <input id="value" name="value" inputMode="numeric" defaultValue={asset.value ?? ""} className="input" />
                </Field>
                <Field label="Ghi chú" htmlFor="note">
                  <textarea id="note" name="note" rows={2} defaultValue={asset.note ?? ""} className="input" />
                </Field>
                <SubmitButton className="btn btn-primary w-full">Lưu thay đổi</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

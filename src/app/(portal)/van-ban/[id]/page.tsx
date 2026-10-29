import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, PenLine, Pencil, Eye } from "lucide-react";
import { requireUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, fmtRelative } from "@/lib/utils";
import { ROLE_LABEL, normalizeRole, type Tone } from "@/lib/constants";
import { AttachmentList, Avatar, Badge, Card, PageHeader, ProgressBar } from "@/components/ui";
import { deleteDocumentAction } from "../actions";
import { DeleteButton } from "@/components/delete-button";
import { SignForm } from "./sign-form";

export const metadata = { title: "Chi tiết văn bản" };

export default async function DocumentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await db.document.findUnique({
    where: { id },
    include: { category: true, createdBy: true, attachments: true },
  });
  if (!doc) notFound();

  // Ghi nhận "đã đọc" khi mở văn bản
  const mine = await db.documentReceipt.upsert({
    where: { documentId_userId: { documentId: id, userId: user.id } },
    create: { documentId: id, userId: user.id, readAt: new Date() },
    update: {},
  });
  if (!mine.readAt) await db.documentReceipt.update({ where: { id: mine.id }, data: { readAt: new Date() } });

  const manager = isManager(user);
  const tracking = manager
    ? await db.user.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true, receipts: { where: { documentId: id } } },
      })
    : [];
  const readCount = tracking.filter((u) => u.receipts[0]?.readAt).length;
  const signedCount = tracking.filter((u) => u.receipts[0]?.signedAt).length;
  const overdue = doc.signDueAt && doc.signDueAt < new Date();

  return (
    <>
      <PageHeader
        title={doc.title}
        back={{ href: "/van-ban", label: "Văn bản" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={(doc.category.color as Tone) ?? "blue"}>{doc.category.name}</Badge>
            {doc.number && <span>Số {doc.number}</span>}
            <span aria-hidden>·</span>
            <span>Ban hành {fmtDate(doc.issuedAt)}</span>
            <span aria-hidden>·</span>
            <span>Người đăng: {doc.createdBy.name}</span>
          </span>
        }
        actions={
          manager && (
            <>
              <Link href={`/van-ban/${doc.id}/sua`} className="btn btn-secondary">
                <Pencil className="size-4" aria-hidden /> Sửa
              </Link>
              <DeleteButton
                action={deleteDocumentAction}
                id={doc.id}
                fields={{ from: "detail" }}
                text="Xóa"
                label={`Xóa văn bản ${doc.title}`}
                confirm="Xóa văn bản này cùng toàn bộ tệp đính kèm và dữ liệu đọc/ký nhận?"
              />
            </>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            {doc.summary && <p className="mb-4 rounded-lg border-l-4 border-brand-600 bg-brand-50 px-4 py-3 text-[15px] font-medium text-brand-800">{doc.summary}</p>}
            {doc.content ? (
              <div className="prose-kb whitespace-pre-line">{doc.content}</div>
            ) : (
              <p className="text-sm text-ink-muted">Nội dung chi tiết xem trong tệp đính kèm.</p>
            )}
            {doc.attachments.length > 0 && (
              <div className="mt-6 border-t border-line pt-4">
                <h2 className="mb-2 text-sm font-semibold text-ink">Tệp đính kèm</h2>
                <AttachmentList items={doc.attachments} />
              </div>
            )}
          </Card>

          {manager && doc.requireSign && (
            <Card
              title="Theo dõi ký nhận"
              actions={
                <span className="text-sm text-ink-muted tabular-nums">
                  {signedCount}/{tracking.length} đã ký
                </span>
              }
              bodyClassName=""
            >
              <div className="grid gap-4 border-b border-line px-5 py-4 sm:grid-cols-2 sm:px-6">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-ink-muted">Đã đọc</span>
                    <span className="font-medium tabular-nums">{Math.round((readCount / Math.max(1, tracking.length)) * 100)}%</span>
                  </div>
                  <ProgressBar value={(readCount / Math.max(1, tracking.length)) * 100} label="Tỷ lệ đã đọc" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-ink-muted">Đã ký nhận</span>
                    <span className="font-medium tabular-nums">{Math.round((signedCount / Math.max(1, tracking.length)) * 100)}%</span>
                  </div>
                  <ProgressBar value={(signedCount / Math.max(1, tracking.length)) * 100} tone="green" label="Tỷ lệ đã ký nhận" />
                </div>
              </div>
              <div className="max-h-[480px] overflow-auto">
                <table className="table">
                  <thead className="sticky top-0">
                    <tr>
                      <th>Cán bộ / Giảng viên</th>
                      <th>Đã đọc</th>
                      <th>Ký nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracking.map((u) => {
                      const r = u.receipts[0];
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={u.name} size="sm" />
                              <div>
                                <div className="font-medium">{u.name}</div>
                                <div className="text-xs text-ink-muted">{ROLE_LABEL[normalizeRole(u.role)]}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-ink-muted">{r?.readAt ? fmtDateTime(r.readAt) : <span className="text-ink-muted/70">Chưa đọc</span>}</td>
                          <td>
                            {r?.signedAt ? (
                              <Badge tone="green">
                                <CheckCircle2 className="size-3" aria-hidden /> {fmtDateTime(r.signedAt)}
                              </Badge>
                            ) : (
                              <Badge tone={overdue ? "red" : "amber"}>{overdue ? "Quá hạn" : "Chưa ký"}</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {doc.requireSign ? (
            <Card title="Ký nhận điện tử">
              {mine.signedAt ? (
                <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <div className="text-sm">
                    <div className="font-semibold">Bạn đã ký nhận văn bản này</div>
                    <div>
                      {mine.signatureName} · {fmtDateTime(mine.signedAt)}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {doc.signDueAt && (
                    <p className={`mb-4 flex items-center gap-2 text-sm ${overdue ? "text-red-700" : "text-amber-800"}`}>
                      <Clock className="size-4" aria-hidden />
                      Hạn ký: {fmtDateTime(doc.signDueAt)} ({fmtRelative(doc.signDueAt)})
                    </p>
                  )}
                  <SignForm documentId={doc.id} name={user.name} />
                </>
              )}
            </Card>
          ) : (
            <Card>
              <div className="flex items-center gap-3 text-sm text-ink-muted">
                <Eye className="size-5" aria-hidden />
                Văn bản thông báo, không yêu cầu ký nhận. Hệ thống đã ghi nhận bạn đã đọc.
              </div>
            </Card>
          )}
          <Card title="Thông tin">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Danh mục</dt>
                <dd className="font-medium">{doc.category.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Ngày ban hành</dt>
                <dd className="font-medium">{fmtDate(doc.issuedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Yêu cầu ký nhận</dt>
                <dd className="font-medium">{doc.requireSign ? <PenLine className="inline size-4 text-amber-600" aria-label="Có" /> : "Không"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Bạn mở lần đầu</dt>
                <dd className="font-medium">{fmtDateTime(mine.readAt ?? new Date())}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}

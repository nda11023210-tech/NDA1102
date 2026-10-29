import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtSize, toLocalInput } from "@/lib/utils";
import { Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DeleteButton } from "@/components/delete-button";
import { deleteDocumentAction, updateDocument } from "../../actions";
import { SignToggle } from "../../moi/sign-toggle";

export const metadata = { title: "Sửa văn bản" };

export default async function EditDocument({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("ADMIN");
  const [doc, categories] = await Promise.all([
    db.document.findUnique({ where: { id }, include: { attachments: true, _count: { select: { receipts: { where: { signedAt: { not: null } } } } } } }),
    db.docCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!doc) notFound();
  const signed = doc._count.receipts;

  return (
    <>
      <PageHeader
        title="Sửa văn bản"
        back={{ href: `/van-ban/${doc.id}`, label: doc.title }}
        actions={
          <DeleteButton
            action={deleteDocumentAction}
            id={doc.id}
            fields={{ from: "detail" }}
            text="Xóa văn bản"
            label={`Xóa văn bản ${doc.title}`}
            confirm="Xóa văn bản này cùng toàn bộ tệp đính kèm và dữ liệu đọc/ký nhận?"
          />
        }
      />
      <Card className="max-w-4xl">
        <ActionForm action={updateDocument} resetOnSuccess={false}>
          <input type="hidden" name="id" value={doc.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Danh mục" htmlFor="categoryId" required>
              <select id="categoryId" name="categoryId" required defaultValue={doc.categoryId} className="input">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Số hiệu" htmlFor="number">
              <input id="number" name="number" defaultValue={doc.number ?? ""} className="input" />
            </Field>
            <Field label="Ngày ban hành" htmlFor="issuedAt">
              <input id="issuedAt" name="issuedAt" type="date" defaultValue={toLocalInput(doc.issuedAt).slice(0, 10)} className="input" />
            </Field>
          </div>
          <Field label="Tiêu đề" htmlFor="title" required>
            <input id="title" name="title" required defaultValue={doc.title} className="input" />
          </Field>
          <Field label="Trích yếu" htmlFor="summary">
            <textarea id="summary" name="summary" rows={2} defaultValue={doc.summary ?? ""} className="input" />
          </Field>
          <Field label="Nội dung" htmlFor="content">
            <textarea id="content" name="content" rows={10} defaultValue={doc.content ?? ""} className="input" />
          </Field>

          {doc.attachments.length > 0 && (
            <fieldset className="rounded-xl border border-line p-4">
              <legend className="px-1 text-sm font-medium text-ink-soft">Tệp đính kèm hiện có – tích để gỡ bỏ</legend>
              <ul className="space-y-1.5">
                {doc.attachments.map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" name="removeAttachment" value={a.id} className="size-4 accent-red-600" />
                      <span className="font-medium">{a.fileName}</span>
                      <span className="text-xs text-ink-muted">{fmtSize(a.size)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <Field label="Thêm tệp đính kèm" htmlFor="files" hint="PDF, Word, Excel, PowerPoint, ảnh, ZIP · tối đa 20MB mỗi tệp.">
            <input id="files" name="files" type="file" multiple className="input" />
          </Field>

          <SignToggle defaultOn={doc.requireSign} defaultDue={doc.signDueAt ? toLocalInput(doc.signDueAt) : ""} />
          {signed > 0 && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <input type="checkbox" name="resetSignatures" className="mt-0.5 size-4 accent-amber-600" />
              <span>
                <span className="block font-medium text-amber-900">Yêu cầu ký nhận lại ({signed} người đã ký)</span>
                <span className="block text-amber-800">Tích khi nội dung thay đổi quan trọng: toàn bộ chữ ký cũ bị hủy để mọi người ký bản mới.</span>
              </span>
            </label>
          )}
          <SubmitButton>Lưu thay đổi</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}

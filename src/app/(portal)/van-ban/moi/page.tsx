import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { toLocalInput } from "@/lib/utils";
import { Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { createDocument } from "../actions";
import { SignToggle } from "./sign-toggle";

export const metadata = { title: "Đăng văn bản" };

export default async function NewDocumentPage() {
  await requireRole("MANAGER");
  const categories = await db.docCategory.findMany({ orderBy: { name: "asc" } });
  const now = toLocalInput(new Date()).slice(0, 10);

  return (
    <>
      <PageHeader title="Đăng văn bản mới" back={{ href: "/van-ban", label: "Văn bản" }} description="Văn bản sẽ hiển thị ngay cho toàn bộ cán bộ, giảng viên của Khoa." />
      <Card className="max-w-4xl">
        <ActionForm action={createDocument} resetOnSuccess={false}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Danh mục" htmlFor="categoryId" required>
              <select id="categoryId" name="categoryId" required className="input">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Số hiệu" htmlFor="number">
              <input id="number" name="number" className="input" placeholder="125/TB-KCNTT" />
            </Field>
            <Field label="Ngày ban hành" htmlFor="issuedAt">
              <input id="issuedAt" name="issuedAt" type="date" defaultValue={now} className="input" />
            </Field>
          </div>
          <Field label="Tiêu đề" htmlFor="title" required>
            <input id="title" name="title" required className="input" />
          </Field>
          <Field label="Trích yếu" htmlFor="summary" hint="Tóm tắt 1–2 câu hiển thị trong danh sách.">
            <textarea id="summary" name="summary" rows={2} className="input" />
          </Field>
          <Field label="Nội dung" htmlFor="content">
            <textarea id="content" name="content" rows={10} className="input" />
          </Field>
          <Field label="Tệp đính kèm" htmlFor="files" hint="PDF, Word, Excel, PowerPoint, ảnh, ZIP · tối đa 20MB mỗi tệp.">
            <input id="files" name="files" type="file" multiple className="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-700" />
          </Field>
          <SignToggle />
          <div className="flex gap-2 pt-2">
            <SubmitButton>Đăng văn bản</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}

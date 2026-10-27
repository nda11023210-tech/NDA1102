import { Field } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { saveArticle } from "./actions";

export function ArticleForm({
  article,
  categories,
}: {
  article?: { id: string; title: string; category: string; content: string; tags: string | null };
  categories: string[];
}) {
  return (
    <ActionForm action={saveArticle} resetOnSuccess={false}>
      {article && <input type="hidden" name="id" value={article.id} />}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Tiêu đề" htmlFor="title" required>
          <input id="title" name="title" required defaultValue={article?.title} className="input" />
        </Field>
        <Field label="Chủ đề" htmlFor="category" required>
          <input id="category" name="category" list="kb-cats" required defaultValue={article?.category} className="input" />
          <datalist id="kb-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field
        label="Nội dung"
        htmlFor="content"
        hint="Hỗ trợ định dạng đơn giản: dòng bắt đầu bằng “1.” hoặc “-” thành danh sách, **chữ đậm**, “## ” cho tiêu đề mục. Viết rõ các bước, hạn chót, biểu mẫu và người tiếp nhận để Trợ lý AI trả lời chính xác."
        required
      >
        <textarea id="content" name="content" required rows={16} defaultValue={article?.content} className="input font-mono text-[13px] leading-6" />
      </Field>
      <Field label="Từ khóa" htmlFor="tags" hint="Phân tách bằng dấu phẩy – giúp tìm kiếm chính xác hơn.">
        <input id="tags" name="tags" defaultValue={article?.tags ?? ""} className="input" placeholder="nghỉ phép, đơn xin nghỉ, phép năm" />
      </Field>
      <SubmitButton>Lưu bài viết</SubmitButton>
    </ActionForm>
  );
}

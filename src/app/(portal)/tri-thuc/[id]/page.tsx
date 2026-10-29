import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { isAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/utils";
import { Badge, Card, PageHeader } from "@/components/ui";
import { Disclosure, SubmitButton } from "@/components/forms";
import { RichText } from "@/components/rich-text";
import { ArticleForm } from "../article-form";
import { deleteArticle } from "../actions";

export const metadata = { title: "Kho tri thức" };

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const article = await db.kbArticle.findUnique({ where: { id }, include: { createdBy: true } });
  if (!article) notFound();
  const manage = isAdmin(user); // sửa/xóa bài viết: chỉ Quản trị viên
  const cats = manage ? await db.kbArticle.findMany({ distinct: ["category"], select: { category: true } }) : [];

  return (
    <>
      <PageHeader
        title={article.title}
        back={{ href: "/tri-thuc", label: "Kho tri thức" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{article.category}</Badge> Cập nhật {fmtDateTime(article.updatedAt)} · {article.createdBy.name}
          </span>
        }
        actions={
          manage && (
            <form action={deleteArticle}>
              <input type="hidden" name="id" value={article.id} />
              <SubmitButton className="btn btn-danger-soft" confirm="Xóa bài viết này khỏi kho tri thức?">
                <Trash2 className="size-4" aria-hidden /> Xóa
              </SubmitButton>
            </form>
          )
        }
      />
      <div className="max-w-4xl space-y-6">
        <Card>
          <RichText text={article.content} />
          {article.tags && (
            <div className="mt-6 flex flex-wrap gap-1.5 border-t border-line pt-4">
              {article.tags.split(",").map((t) => (
                <Badge key={t}>{t.trim()}</Badge>
              ))}
            </div>
          )}
        </Card>
        {manage && (
          <Disclosure summary="Chỉnh sửa bài viết">
            <ArticleForm article={article} categories={cats.map((c) => c.category)} />
          </Disclosure>
        )}
      </div>
    </>
  );
}

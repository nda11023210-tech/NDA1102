import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { ArticleForm } from "../article-form";

export const metadata = { title: "Thêm bài viết" };

export default async function NewArticle() {
  await requireRole("HEAD", "ASSISTANT");
  const cats = await db.kbArticle.findMany({ distinct: ["category"], select: { category: true } });
  return (
    <>
      <PageHeader title="Thêm bài viết vào kho tri thức" back={{ href: "/tri-thuc", label: "Kho tri thức" }} />
      <Card className="max-w-4xl">
        <ArticleForm categories={cats.map((c) => c.category)} />
      </Card>
    </>
  );
}

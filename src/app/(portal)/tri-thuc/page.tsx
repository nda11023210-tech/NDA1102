import Link from "next/link";
import { BookOpen, Plus, Search, Bot } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageKb } from "@/lib/permissions";
import { searchKb } from "@/lib/kb-search";
import { cn, fmtDate } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Kho tri thức" };

export default async function KnowledgeBase({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const user = await requireUser();
  const { q, cat } = await searchParams;
  const all = await db.kbArticle.findMany({ orderBy: [{ category: "asc" }, { title: "asc" }] });
  const categories = [...new Set(all.map((a) => a.category))];
  const list = q ? searchKb(all, q, 50).map((h) => h.doc) : all.filter((a) => !cat || a.category === cat);
  const full = new Map(all.map((a) => [a.id, a]));

  return (
    <>
      <PageHeader
        title="Kho tri thức"
        description="Quy chế, quy trình, hướng dẫn công việc tại Khoa. Đây cũng là nguồn dữ liệu để Trợ lý AI trả lời câu hỏi."
        actions={
          <>
            <Link href="/tro-ly" className="btn btn-secondary">
              <Bot className="size-4" aria-hidden /> Hỏi Trợ lý AI
            </Link>
            {canManageKb(user) && (
              <Link href="/tri-thuc/moi" className="btn btn-primary">
                <Plus className="size-4" aria-hidden /> Thêm bài viết
              </Link>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Chủ đề" className="flex flex-wrap gap-1 rounded-xl bg-slate-200/60 p-1">
          <Link href="/tri-thuc" className={cn("tab", !cat && !q && "tab-active")}>
            Tất cả
          </Link>
          {categories.map((c) => (
            <Link key={c} href={`/tri-thuc?cat=${encodeURIComponent(c)}`} className={cn("tab", cat === c && "tab-active")}>
              {c}
            </Link>
          ))}
        </nav>
        <form action="/tri-thuc" className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <label htmlFor="kb-q" className="sr-only">
            Tìm trong kho tri thức
          </label>
          <input id="kb-q" name="q" defaultValue={q} placeholder="Tìm kiếm (không cần gõ dấu)…" className="input pl-9 lg:w-80" />
        </form>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState icon={BookOpen} title="Không tìm thấy bài viết phù hợp" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => {
            const a = full.get(d.id)!;
            return (
              <Link key={a.id} href={`/tri-thuc/${a.id}`} className="card card-pad flex flex-col transition-shadow duration-200 hover:shadow-md">
                <Badge tone="blue" className="self-start">
                  {a.category}
                </Badge>
                <h2 className="mt-3 font-semibold text-ink text-balance">{a.title}</h2>
                <p className="mt-1.5 line-clamp-3 text-sm text-ink-muted">{a.content.replace(/[#*_`]/g, "")}</p>
                <div className="mt-auto pt-4 text-xs text-ink-muted">Cập nhật {fmtDate(a.updatedAt)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

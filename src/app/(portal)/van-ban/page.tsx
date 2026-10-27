import Link from "next/link";
import { FileText, Plus, Paperclip, PenLine, Search, CheckCircle2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn, fmtDate } from "@/lib/utils";
import type { Tone } from "@/lib/constants";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { createCategory } from "./actions";

export const metadata = { title: "Văn bản & Thông báo" };

type SP = { cat?: string; q?: string; f?: string };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const manager = isManager(user);
  const sp = await searchParams;

  const where: Prisma.DocumentWhereInput = {};
  if (sp.cat) where.category = { slug: sp.cat };
  if (sp.q) where.OR = [{ title: { contains: sp.q } }, { number: { contains: sp.q } }, { summary: { contains: sp.q } }];
  if (sp.f === "unsigned") {
    where.requireSign = true;
    where.NOT = { receipts: { some: { userId: user.id, signedAt: { not: null } } } };
  } else if (sp.f === "unread") {
    where.NOT = { receipts: { some: { userId: user.id, readAt: { not: null } } } };
  }

  const [categories, docs, staffCount] = await Promise.all([
    db.docCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { documents: true } } } }),
    db.document.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      take: 100,
      include: {
        category: true,
        _count: { select: { attachments: true } },
        receipts: { select: { userId: true, readAt: true, signedAt: true } },
      },
    }),
    db.user.count({ where: { active: true } }),
  ]);

  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/van-ban?${s}` : "/van-ban";
  };

  return (
    <>
      <PageHeader
        title="Văn bản & Thông báo"
        description="Công văn, thông báo, quyết định của Khoa. Văn bản có nhãn “Cần ký nhận” yêu cầu giảng viên xác nhận điện tử."
        actions={
          manager && (
            <Link href="/van-ban/moi" className="btn btn-primary">
              <Plus className="size-4" aria-hidden /> Đăng văn bản
            </Link>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Danh mục" className="flex flex-wrap gap-1 rounded-xl bg-slate-200/60 p-1">
          <Link href={qs({ cat: undefined })} className={cn("tab", !sp.cat && "tab-active")}>
            Tất cả
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={qs({ cat: c.slug })} className={cn("tab", sp.cat === c.slug && "tab-active")}>
              {c.name}
              <span className="ml-1.5 text-xs text-ink-muted tabular-nums">{c._count.documents}</span>
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" action="/van-ban">
          {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
          <label htmlFor="doc-filter" className="sr-only">
            Lọc
          </label>
          <select id="doc-filter" name="f" defaultValue={sp.f ?? ""} className="input w-auto">
            <option value="">Mọi trạng thái</option>
            <option value="unread">Chưa đọc</option>
            <option value="unsigned">Chưa ký nhận</option>
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <label htmlFor="doc-q" className="sr-only">
              Tìm kiếm văn bản
            </label>
            <input id="doc-q" name="q" defaultValue={sp.q} placeholder="Tìm số hiệu, tiêu đề…" className="input w-full pl-9 sm:w-64" />
          </div>
          <button className="btn btn-secondary">Lọc</button>
        </form>
      </div>

      <Card bodyClassName="divide-y divide-line">
        {docs.length === 0 ? (
          <EmptyState icon={FileText} title="Không có văn bản phù hợp">
            Thử bỏ bớt bộ lọc hoặc từ khóa tìm kiếm.
          </EmptyState>
        ) : (
          docs.map((d) => {
            const mine = d.receipts.find((r) => r.userId === user.id);
            const signedCount = d.receipts.filter((r) => r.signedAt).length;
            const unread = !mine?.readAt;
            return (
              <Link
                key={d.id}
                href={`/van-ban/${d.id}`}
                className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-5 sm:px-6"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className={cn("mt-2 size-2 shrink-0 rounded-full", unread ? "bg-action" : "bg-transparent")} aria-hidden />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={(d.category.color as Tone) ?? "blue"}>{d.category.name}</Badge>
                      {d.number && <span className="text-xs font-medium text-ink-muted">Số {d.number}</span>}
                      {unread && <span className="sr-only">Chưa đọc</span>}
                    </div>
                    <div className={cn("mt-1 line-clamp-2 text-[15px]", unread ? "font-semibold text-ink" : "font-medium text-ink-soft")}>{d.title}</div>
                    {d.summary && <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">{d.summary}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 pl-5 text-sm text-ink-muted sm:pl-0">
                  {d._count.attachments > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="size-3.5" aria-hidden />
                      {d._count.attachments}
                    </span>
                  )}
                  {d.requireSign &&
                    (mine?.signedAt ? (
                      <Badge tone="green">
                        <CheckCircle2 className="size-3" aria-hidden /> Đã ký
                      </Badge>
                    ) : (
                      <Badge tone="amber">
                        <PenLine className="size-3" aria-hidden /> Cần ký nhận
                      </Badge>
                    ))}
                  {manager && d.requireSign && (
                    <span className="text-xs tabular-nums">
                      {signedCount}/{staffCount} đã ký
                    </span>
                  )}
                  <time className="w-[84px] text-right tabular-nums">{fmtDate(d.issuedAt)}</time>
                </div>
              </Link>
            );
          })
        )}
      </Card>

      {manager && (
        <Disclosure summary="Quản lý danh mục văn bản" className="mt-6">
          <ActionForm action={createCategory} className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="cat-name" className="label">
                Tên danh mục mới
              </label>
              <input id="cat-name" name="name" className="input" placeholder="Ví dụ: Kế hoạch" />
            </div>
            <div>
              <label htmlFor="cat-color" className="label">
                Màu nhãn
              </label>
              <select id="cat-color" name="color" className="input">
                <option value="blue">Xanh dương</option>
                <option value="green">Xanh lá</option>
                <option value="amber">Vàng</option>
                <option value="red">Đỏ</option>
                <option value="violet">Tím</option>
                <option value="slate">Xám</option>
              </select>
            </div>
            <SubmitButton>Thêm danh mục</SubmitButton>
          </ActionForm>
        </Disclosure>
      )}
    </>
  );
}

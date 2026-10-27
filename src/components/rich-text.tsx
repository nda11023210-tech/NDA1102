import { Fragment } from "react";

/** Định dạng inline: **đậm**, _nghiêng_, `mã` – không dùng innerHTML để tránh XSS */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="rounded bg-slate-100 px-1 text-[0.9em]">{p.slice(1, -1)}</code>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/** Hiển thị Markdown đơn giản (đoạn văn, tiêu đề, danh sách) từ AI/kho tri thức */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={list.ordered ? "mb-3 list-decimal space-y-1 pl-5" : "mb-3 list-disc space-y-1 pl-5"}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)/);
    const num = line.match(/^\d+[.)]\s+(.*)/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line) continue;
    const h = line.match(/^#{1,4}\s+(.*)/);
    if (h) blocks.push(<p key={blocks.length} className="mt-4 mb-1.5 font-semibold text-ink first:mt-0">{inline(h[1])}</p>);
    else blocks.push(<p key={blocks.length} className="mb-2.5">{inline(line)}</p>);
  }
  flush();
  return <div className={`text-[15px] leading-7 text-ink-soft ${className}`}>{blocks}</div>;
}

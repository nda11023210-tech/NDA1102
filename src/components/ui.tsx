import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import type { Tone } from "@/lib/constants";

const TONES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  blue: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/25",
  red: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  slate: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/20",
  violet: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20",
};

export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("badge", TONES[tone], className)}>{children}</span>;
}

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: Tone }>; value: string }) {
  const s = map[value] ?? { label: value, tone: "slate" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex text-sm font-medium text-action hover:underline">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-balance text-ink sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-pretty text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STAT_TONES: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
  violet: "bg-violet-50 text-violet-600",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "blue",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className="card card-pad flex h-full items-start gap-4 transition-shadow duration-200 hover:shadow-md">
      <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl", STAT_TONES[tone])}>
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-ink-muted">{label}</div>
        <div className="mt-0.5 text-2xl font-bold text-ink tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-ink-muted">{hint}</div>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-muted">{children}</div>}
    </div>
  );
}

const AVATAR_COLORS = ["bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-cyan-700", "bg-indigo-600"];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        AVATAR_COLORS[idx],
        size === "sm" && "size-7 text-[11px]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-12 text-sm",
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-6">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {actions}
        </header>
      )}
      <div className={bodyClassName ?? "card-pad"}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  required,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value, tone = "blue", label }: { value: number; tone?: "blue" | "green" | "amber"; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-action";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AttachmentList({ items }: { items: { id: string; fileName: string; size: number }[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((a) => (
        <li key={a.id}>
          <a
            href={`/api/files/${a.id}`}
            className="inline-flex max-w-xs items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-action hover:text-action"
          >
            <span className="truncate">{a.fileName}</span>
            <span className="shrink-0 text-xs text-ink-muted">{Math.max(1, Math.round(a.size / 1024))} KB</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

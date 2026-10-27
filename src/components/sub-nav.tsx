"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SubNav({ items }: { items: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Điều hướng phụ" className="mb-6 -mx-1 overflow-x-auto px-1">
      <ul className="inline-flex gap-1 rounded-xl bg-slate-200/60 p-1">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? "page" : undefined} className={cn("tab whitespace-nowrap", active && "tab-active")}>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

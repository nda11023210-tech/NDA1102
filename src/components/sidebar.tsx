"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Boxes,
  ClipboardCheck,
  CalendarRange,
  ListTodo,
  BarChart3,
  Bot,
  BookOpen,
  Users,
  LogOut,
  Menu,
  X,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FACULTY_NAME, ROLE_LABEL, type Role } from "@/lib/constants";
import { Avatar } from "./ui";

type NavItem = { href: string; label: string; icon: LucideIcon; roles?: Role[]; badgeKey?: string };

const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Tổng quan", items: [{ href: "/", label: "Bảng điều khiển", icon: LayoutDashboard }] },
  {
    group: "Nghiệp vụ",
    items: [
      { href: "/van-ban", label: "Văn bản & Thông báo", icon: FileText, badgeKey: "docs" },
      { href: "/tai-san", label: "Tài sản & Thiết bị", icon: Boxes, badgeKey: "loans" },
      { href: "/minh-chung", label: "Minh chứng Sở ngành", icon: ClipboardCheck, badgeKey: "evidence" },
      { href: "/thoi-khoa-bieu", label: "Thời khóa biểu", icon: CalendarRange },
      { href: "/cong-viec", label: "Công việc", icon: ListTodo, badgeKey: "tasks" },
      { href: "/hieu-suat", label: "Hiệu suất", icon: BarChart3 },
    ],
  },
  {
    group: "Hỗ trợ",
    items: [
      { href: "/tro-ly", label: "Trợ lý AI", icon: Bot },
      { href: "/tri-thuc", label: "Kho tri thức", icon: BookOpen },
    ],
  },
  { group: "Quản trị", items: [{ href: "/nguoi-dung", label: "Người dùng", icon: Users, roles: ["ADMIN"] }] },
];

export function Sidebar({
  user,
  badges,
  logout,
}: {
  user: { name: string; role: Role; email: string };
  badges: Record<string, number>;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  const nav = (
    <nav aria-label="Điều hướng chính" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {NAV.map(({ group, items }) => {
        const visible = items.filter((i) => !i.roles || i.roles.includes(user.role));
        if (!visible.length) return null;
        return (
          <div key={group}>
            <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.12em] text-blue-200/60 uppercase">{group}</div>
            <ul className="space-y-0.5">
              {visible.map(({ href, label, icon: Icon, badgeKey }) => {
                const active = isActive(href);
                const count = badgeKey ? badges[badgeKey] ?? 0 : 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                        active ? "bg-white/12 text-white shadow-[inset_3px_0_0_#60a5fa]" : "text-blue-100/80 hover:bg-white/6 hover:text-white",
                      )}
                    >
                      <Icon className={cn("size-[18px] shrink-0", active ? "text-blue-300" : "text-blue-200/70 group-hover:text-blue-200")} aria-hidden />
                      <span className="flex-1 truncate">{label}</span>
                      {count > 0 && (
                        <span className="min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-[11px] leading-5 font-semibold text-brand-900">
                          {count > 99 ? "99+" : count}
                          <span className="sr-only"> mục cần xử lý</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const shell = (
    <div className="flex h-full flex-col bg-brand-900 text-white">
      <Link href="/" className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <Image src="/logo.svg" alt="" width={38} height={38} priority />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-semibold">{FACULTY_NAME}</div>
          <div className="text-[11px] text-blue-200/70">CĐ Công nghiệp Bắc Ninh</div>
        </div>
      </Link>
      {nav}
      <div className="border-t border-white/10 p-3">
        <Link href="/tai-khoan" className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/6">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-blue-200/70">{ROLE_LABEL[user.role]}</div>
          </div>
          <UserCog className="size-4 text-blue-200/60" aria-hidden />
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="mt-1 flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-blue-100/80 transition-colors hover:bg-white/6 hover:text-white"
          >
            <LogOut className="size-[18px]" aria-hidden /> Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Thanh trên cùng cho di động */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-brand-900 px-4 py-2.5 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-white/10"
          aria-label="Mở menu"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </button>
        <Image src="/logo.svg" alt="" width={30} height={30} />
        <span className="truncate font-semibold">{FACULTY_NAME}</span>
      </div>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[264px] lg:block">{shell}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu điều hướng">
          <button type="button" className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} aria-label="Đóng menu" />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-2xl">
            {shell}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 grid size-10 cursor-pointer place-items-center rounded-lg text-white hover:bg-white/10"
              aria-label="Đóng menu"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

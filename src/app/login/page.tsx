import Image from "next/image";
import { redirect } from "next/navigation";
import { FileCheck2, Boxes, ClipboardCheck, CalendarRange, BarChart3, Bot } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { FACULTY_NAME, SCHOOL_NAME } from "@/lib/constants";
import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập" };

const FEATURES = [
  { icon: FileCheck2, text: "Văn bản điện tử & ký nhận" },
  { icon: Boxes, text: "Tài sản, mượn trả, kiểm kê QR" },
  { icon: ClipboardCheck, text: "Minh chứng duyệt 2 cấp" },
  { icon: CalendarRange, text: "Xếp thời khóa biểu tự động" },
  { icon: BarChart3, text: "Giao việc & đánh giá hiệu suất" },
  { icon: Bot, text: "Trợ lý AI tra cứu quy chế 24/7" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-blue-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-32 size-[460px] rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <Image src="/logo.png" alt="Logo Trường Cao đẳng Công nghiệp Bắc Ninh" width={56} height={56} priority className="rounded-full bg-white p-0.5 shadow-lg ring-2 ring-white/20" />
          <div>
            <div className="text-xs font-medium tracking-[0.14em] text-blue-200 uppercase">{SCHOOL_NAME}</div>
            <div className="text-lg font-semibold">{FACULTY_NAME}</div>
          </div>
        </div>

        <div className="relative max-w-xl">
          <h1 className="text-4xl leading-tight font-bold text-balance xl:text-[44px]">
            Cổng quản trị số
            <br />
            <span className="text-blue-300">dành cho giảng viên</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-blue-100/85">
            Một nơi duy nhất để nhận văn bản, quản lý thiết bị, nộp minh chứng, xem lịch dạy và theo dõi công việc của Khoa.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm backdrop-blur-sm">
                <Icon className="size-[18px] shrink-0 text-blue-300" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-blue-200/70">© {new Date().getFullYear()} {FACULTY_NAME} · Hệ thống nội bộ</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/logo.png" alt="Logo Trường Cao đẳng Công nghiệp Bắc Ninh" width={52} height={52} priority className="rounded-full bg-white" />
            <div>
              <div className="text-[11px] font-medium tracking-wider text-ink-muted uppercase">{SCHOOL_NAME}</div>
              <div className="font-semibold text-ink">{FACULTY_NAME}</div>
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">Đăng nhập</h2>
          <p className="mt-1 text-sm text-ink-muted">Sử dụng tài khoản do Khoa cấp để truy cập hệ thống.</p>
          <LoginForm next={next ?? ""} />
          <p className="mt-8 text-center text-xs text-ink-muted">
            Quên mật khẩu? Liên hệ Trợ lý khoa hoặc Quản trị viên để được cấp lại.
          </p>
        </div>
      </section>
    </main>
  );
}

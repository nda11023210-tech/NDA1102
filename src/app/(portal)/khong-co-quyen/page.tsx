import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata = { title: "Không có quyền truy cập" };

export default function Forbidden() {
  return (
    <div className="card mx-auto mt-10 max-w-lg card-pad text-center">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-amber-50 text-amber-600">
        <ShieldAlert className="size-7" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">Bạn không có quyền truy cập trang này</h1>
      <p className="mt-2 text-sm text-ink-muted">Chức năng này chỉ dành cho một số vai trò nhất định. Nếu cần quyền, vui lòng liên hệ Quản trị viên.</p>
      <Link href="/" className="btn btn-brand mt-6">
        Về bảng điều khiển
      </Link>
    </div>
  );
}

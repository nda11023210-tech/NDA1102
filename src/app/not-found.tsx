import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-action">404</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm text-ink-muted">Trang bạn tìm không tồn tại hoặc đã bị xóa.</p>
        <Link href="/" className="btn btn-brand mt-6">
          Về bảng điều khiển
        </Link>
      </div>
    </main>
  );
}

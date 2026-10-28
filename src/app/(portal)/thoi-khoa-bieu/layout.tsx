import { SubNav } from "@/components/sub-nav";
import { requireUser } from "@/lib/auth";
import { canManageTimetable } from "@/lib/permissions";

export default async function TimetableLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <SubNav
        items={[
          { href: "/thoi-khoa-bieu", label: "Thời khóa biểu", exact: true },
          { href: "/thoi-khoa-bieu/dang-ky-mon", label: "Đăng ký môn dạy" },
          ...(canManageTimetable(user) ? [{ href: "/thoi-khoa-bieu/phan-cong", label: "Phân công & dữ liệu nền" }] : []),
        ]}
      />
      {children}
    </>
  );
}

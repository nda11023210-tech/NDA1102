import { SubNav } from "@/components/sub-nav";

export default function AssetsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav
        items={[
          { href: "/tai-san", label: "Danh mục tài sản", exact: true },
          { href: "/tai-san/muon-tra", label: "Mượn / Trả" },
          { href: "/tai-san/kiem-ke", label: "Kiểm kê QR" },
        ]}
      />
      {children}
    </>
  );
}

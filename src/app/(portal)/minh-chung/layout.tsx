import { SubNav } from "@/components/sub-nav";
import { requireUser, isManager } from "@/lib/auth";

export default async function EvidenceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <SubNav
        items={[
          { href: "/minh-chung", label: "Các đợt minh chứng", exact: true },
          ...(isManager(user) ? [{ href: "/minh-chung/duyet", label: "Hàng chờ duyệt" }] : []),
          { href: "/minh-chung/cua-toi", label: "Minh chứng của tôi" },
        ]}
      />
      {children}
    </>
  );
}

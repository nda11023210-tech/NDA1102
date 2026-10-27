import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { APP_NAME, FACULTY_NAME, SCHOOL_NAME } from "@/lib/constants";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: `Hệ thống quản trị nội bộ ${FACULTY_NAME} – ${SCHOOL_NAME}`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#1e3a5f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}

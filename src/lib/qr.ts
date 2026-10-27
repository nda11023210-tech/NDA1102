import "server-only";
import QRCode from "qrcode";
import { headers } from "next/headers";

/** Địa chỉ gốc của site (dùng cho nội dung mã QR) */
export async function siteOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function assetQrSvg(code: string) {
  const url = `${await siteOrigin()}/tai-san/${encodeURIComponent(code)}`;
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0c1f38", light: "#ffffff" } });
}

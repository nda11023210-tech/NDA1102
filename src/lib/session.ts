// Ký/xác minh JWT phiên đăng nhập – dùng được cả ở middleware (Edge) và server.
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./constants";

export const SESSION_COOKIE = "kcntt_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 giờ

export type SessionPayload = { sub: string; name: string; role: Role };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET chưa được cấu hình (tối thiểu 32 ký tự)");
    return new TextEncoder().encode("dev-only-secret-change-me-dev-only-secret");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { sub: payload.sub as string, name: payload.name as string, role: payload.role as Role };
  } catch {
    return null;
  }
}

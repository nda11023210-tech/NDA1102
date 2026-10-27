export type ActionState = { ok: boolean; message: string } | null;

export const ok = (message: string): ActionState => ({ ok: true, message });
export const fail = (message: string): ActionState => ({ ok: false, message });

/** Bọc server action: bắt lỗi và trả về thông báo thân thiện */
export async function attempt(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    // redirect()/notFound() của Next.js phải được ném tiếp
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error(e);
    return fail(e instanceof Error ? e.message : "Đã có lỗi xảy ra, vui lòng thử lại.");
  }
}

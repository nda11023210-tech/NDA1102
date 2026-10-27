import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Tham số chung cho mọi lời gọi: bật cơ chế dự phòng phía máy chủ ("fallbacks: default") –
 * nếu mô hình chính từ chối một yêu cầu, API tự chạy lại trên mô hình dự phòng phù hợp.
 */
export const FALLBACK: Pick<Anthropic.Beta.MessageCreateParams, "betas" | "fallbacks"> = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

/** Lấy phần văn bản từ phản hồi (bỏ qua các khối thinking/fallback) */
export function textOf(content: Anthropic.Beta.BetaContentBlock[]) {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

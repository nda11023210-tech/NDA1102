import { normalizeVi } from "./utils";

export type KbDoc = { id: string; title: string; category: string; content: string; tags: string | null };

// Từ phổ biến không mang nghĩa tra cứu
const STOP = new Set(
  "la cua va cac co cho khi nao the nao gi lam sao duoc toi em anh chi thi o tai voi nhu mot nhung de ve neu can phai bao nhieu hay khong ai dau vay a nhe".split(" "),
);

function tokens(s: string) {
  return normalizeVi(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/**
 * Xếp hạng bài viết theo BM25 (bỏ dấu tiếng Việt), có cộng điểm cho tiêu đề/thẻ
 * và cụm hai từ liền nhau (bigram) để ưu tiên cụm như "nghi phep", "giang day".
 */
export function searchKb(docs: KbDoc[], query: string, limit = 4) {
  const q = tokens(query);
  if (!q.length) return [];
  const qBigrams = q.slice(1).map((t, i) => `${q[i]} ${t}`);

  const prepared = docs.map((d) => {
    const body = tokens(`${d.content}`);
    const head = tokens(`${d.title} ${d.tags ?? ""} ${d.category}`);
    const all = [...head, ...head, ...head, ...body]; // tiêu đề/thẻ nặng gấp 3
    const tf = new Map<string, number>();
    for (const t of all) tf.set(t, (tf.get(t) ?? 0) + 1);
    const joined = ` ${[...head, ...body].join(" ")} `;
    return { d, tf, len: all.length, joined };
  });
  const N = prepared.length;
  const avg = prepared.reduce((a, p) => a + p.len, 0) / Math.max(1, N);
  const k1 = 1.4;
  const b = 0.75;

  const scored = prepared.map((p) => {
    let score = 0;
    for (const t of new Set(q)) {
      const df = prepared.filter((x) => x.tf.has(t)).length;
      if (!df) continue;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const f = p.tf.get(t) ?? 0;
      score += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * p.len) / avg));
    }
    for (const bg of qBigrams) if (p.joined.includes(` ${bg} `)) score += 1.5;
    return { doc: p.d, score };
  });
  const ranked = scored.filter((s) => s.score > 0.5).sort((a, b) => b.score - a.score);
  // Bỏ các kết quả kém liên quan hẳn so với kết quả tốt nhất
  const top = ranked[0]?.score ?? 0;
  return ranked.filter((s) => s.score >= top * 0.35).slice(0, limit);
}

/** Trích đoạn liên quan nhất (dùng khi chạy chế độ không AI) */
export function bestSnippet(content: string, query: string, max = 420) {
  const q = new Set(tokens(query));
  const paras = content.split(/\n\s*\n|\n(?=\d+\.|- )/).map((p) => p.trim()).filter(Boolean);
  let best = paras[0] ?? content;
  let bestScore = -1;
  for (const p of paras) {
    const s = tokens(p).filter((t) => q.has(t)).length;
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return best.length > max ? best.slice(0, max).trimEnd() + "…" : best;
}

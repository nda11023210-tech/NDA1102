"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Square, BookOpen, RotateCcw, Sparkles } from "lucide-react";
import { RichText } from "@/components/rich-text";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; sources?: { id: string; title: string }[] };

export function ChatBox({
  userName,
  ai,
  kbCount,
  categories,
  suggestions,
}: {
  userName: string;
  ai: boolean;
  kbCount: number;
  categories: string[];
  suggestions: string[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "Lỗi máy chủ");
      let sources: Msg["sources"] = [];
      try {
        sources = JSON.parse(decodeURIComponent(res.headers.get("X-Sources") ?? "%5B%5D"));
      } catch {}
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc, sources }]);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMessages((m) => {
          const last = m[m.length - 1];
          return [...m.slice(0, -1), { ...last, content: last.content ? `${last.content}\n\n_(Đã dừng)_` : "_(Đã dừng)_" }];
        });
      } else {
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: `_${(e as Error).message || "Không gửi được câu hỏi."}_` }]);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="card flex h-[calc(100dvh-7rem)] min-h-[520px] flex-col overflow-hidden lg:h-[calc(100dvh-4rem)]">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-brand-700 text-white">
            <Bot className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="font-semibold text-ink">Trợ lý Khoa CNTT</h1>
            <p className="text-xs text-ink-muted">
              {ai ? "Claude AI" : "Tra cứu nhanh"} · {kbCount} tài liệu quy chế, quy trình
            </p>
          </div>
        </div>
        {!empty && (
          <button type="button" onClick={() => setMessages([])} className="btn btn-ghost btn-sm" disabled={busy}>
            <RotateCcw className="size-4" aria-hidden /> Cuộc trò chuyện mới
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8" aria-live="polite" aria-busy={busy}>
        {empty ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center pt-6 text-center sm:pt-12">
            <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Sparkles className="size-7" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-ink text-balance">Xin chào {userName.split(" ").slice(-1)[0]}, bạn cần tra cứu thủ tục gì?</h2>
            <p className="mt-2 max-w-md text-sm text-ink-muted">
              Hỏi bất kỳ điều gì về quy chế, quy trình làm việc tại Khoa. Câu trả lời dựa trên kho tri thức chính thức và luôn kèm nguồn.
            </p>
            <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="cursor-pointer rounded-xl border border-line bg-white px-4 py-3 text-left text-sm text-ink-soft transition-colors hover:border-action hover:bg-blue-50/50 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
            {categories.length > 0 && <p className="mt-6 text-xs text-ink-muted">Chủ đề: {categories.join(" · ")}</p>}
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                {m.role === "user" ? (
                  <Avatar name={userName} size="sm" />
                ) : (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-white" aria-hidden>
                    <Bot className="size-4" />
                  </span>
                )}
                <div className={cn("min-w-0 max-w-[85%]", m.role === "user" && "rounded-2xl rounded-tr-sm bg-action px-4 py-2.5 text-[15px] text-white")}>
                  <span className="sr-only">{m.role === "user" ? "Bạn hỏi:" : "Trợ lý trả lời:"}</span>
                  {m.role === "user" ? (
                    <p className="whitespace-pre-line">{m.content}</p>
                  ) : m.content ? (
                    <>
                      <RichText text={m.content} />
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-ink-muted">Nguồn:</span>
                          {m.sources.map((s) => (
                            <Link
                              key={s.id}
                              href={`/tri-thuc/${s.id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-line bg-slate-50 px-2 py-0.5 text-xs text-ink-soft hover:border-action hover:text-action"
                            >
                              <BookOpen className="size-3" aria-hidden />
                              {s.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex gap-1 py-3" aria-label="Đang soạn câu trả lời">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="size-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d * 150}ms` }} />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-line bg-white px-4 py-3 sm:px-8"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Câu hỏi
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Nhập câu hỏi… (Enter để gửi, Shift+Enter xuống dòng)"
            className="input max-h-40 min-h-11 resize-none"
          />
          {busy ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="btn btn-secondary min-h-11" aria-label="Dừng trả lời">
              <Square className="size-4" aria-hidden />
            </button>
          ) : (
            <button type="submit" className="btn btn-primary min-h-11" disabled={!input.trim()} aria-label="Gửi câu hỏi">
              <Send className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-ink-muted">
          Trợ lý có thể sai sót. Với quyết định quan trọng, vui lòng đối chiếu văn bản gốc hoặc hỏi Trợ lý khoa.
        </p>
      </form>
    </div>
  );
}

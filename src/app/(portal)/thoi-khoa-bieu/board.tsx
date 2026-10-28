"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, AlertTriangle, MousePointerClick, Loader2 } from "lucide-react";
import { DAYS, SLOTS, SESSIONS_PER_LECTURER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { moveEntry, toggleLock } from "./actions";

export type BoardEntry = {
  id: string;
  day: number;
  slot: number;
  locked: boolean;
  kind: string;
  subject: string;
  subjectCode: string;
  classCode: string;
  roomId: string;
  roomCode: string;
  lecturerId: string;
  outside: boolean; // giảng viên không đăng ký môn này
  conflicts: string[];
};
export type BoardRoom = { id: string; code: string; type: string };
export type BoardLecturer = { id: string; name: string };

/**
 * Bảng TKB toàn Khoa (hàng = giảng viên, cột = 10 buổi trong tuần).
 * Chỉnh tay: kéo-thả buổi học sang ô khác trong cùng hàng, hoặc bấm chọn buổi rồi bấm ô đích
 * (dùng được bằng bàn phím và trên màn hình cảm ứng).
 */
export function TimetableBoard({ entries, lecturers, rooms, editable }: { entries: BoardEntry[]; lecturers: BoardLecturer[]; rooms: BoardRoom[]; editable: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const sel = entries.find((e) => e.id === selected) ?? null;

  const byCell = useMemo(() => {
    const m = new Map<string, BoardEntry[]>();
    for (const e of entries) {
      const k = `${e.lecturerId}:${e.day}:${e.slot}`;
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [entries]);

  const run = (fn: () => Promise<{ ok: boolean; message: string } | null>) =>
    start(async () => {
      const r = await fn();
      if (r) setMessage({ ok: r.ok, text: r.message });
      router.refresh();
    });

  const moveTo = (entryId: string, day: number, slot: number, roomId?: string) => {
    const e = entries.find((x) => x.id === entryId);
    if (!e || (e.day === day && e.slot === slot && !roomId)) return;
    setSelected(null);
    run(() => moveEntry(entryId, day, slot, roomId));
  };

  const busyRooms = sel ? new Set(entries.filter((e) => e.day === sel.day && e.slot === sel.slot && e.id !== sel.id).map((e) => e.roomId)) : new Set<string>();
  const conflictCount = entries.filter((e) => e.conflicts.length).length;

  return (
    <div>
      {editable && (
        <div className="flex flex-col gap-3 border-b border-line bg-slate-50/70 px-5 py-3 text-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between" aria-live="polite">
          {sel ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                Đã chọn: {sel.subject} · {sel.classCode} · {DAYS[sel.day]} {SLOTS[sel.slot].label}
              </span>
              <label htmlFor="room-pick" className="sr-only">
                Đổi phòng
              </label>
              <select
                id="room-pick"
                className="input min-h-8 w-auto py-1"
                value={sel.roomId}
                onChange={(ev) => moveTo(sel.id, sel.day, sel.slot, ev.target.value)}
              >
                {rooms
                  .filter((r) => r.type === (sel.kind === "MD" ? "LAB" : "THEORY"))
                  .map((r) => (
                    <option key={r.id} value={r.id} disabled={busyRooms.has(r.id)}>
                      Phòng {r.code}
                      {busyRooms.has(r.id) ? " (bận)" : ""}
                    </option>
                  ))}
              </select>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(() => toggleLock(sel.id))}>
                {sel.locked ? <LockOpen className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
                {sel.locked ? "Mở khóa" : "Khóa"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
                Bỏ chọn
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-ink-muted">
              <MousePointerClick className="size-4" aria-hidden />
              Kéo-thả hoặc bấm chọn một buổi rồi bấm ô đích trong cùng hàng để chuyển. Buổi đã chỉnh sẽ tự khóa, giữ nguyên khi xếp lại.
            </div>
          )}
          <div className="flex items-center gap-3">
            {pending && <Loader2 className="size-4 animate-spin text-action" aria-label="Đang lưu" />}
            {message && <span className={message.ok ? "text-emerald-700" : "text-red-700"}>{message.text}</span>}
            {conflictCount > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-red-700">
                <AlertTriangle className="size-4" aria-hidden /> {conflictCount} buổi xung đột
              </span>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1500px] table-fixed border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th rowSpan={2} className="sticky left-0 z-10 w-52 border-b border-line bg-slate-50 px-3 py-2 text-left font-semibold text-ink-muted uppercase">
                Giảng viên
              </th>
              {DAYS.map((d) => (
                <th key={d} colSpan={2} className="border-b border-l border-line bg-slate-50 px-2 py-1.5 text-center font-semibold text-ink-soft">
                  {d}
                </th>
              ))}
            </tr>
            <tr>
              {DAYS.flatMap((d) =>
                SLOTS.map((s) => (
                  <th key={d + s.label} className="border-b border-l border-line bg-slate-50 px-2 py-1 text-center font-medium text-ink-muted">
                    {s.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {lecturers.map((l) => {
              const count = entries.filter((e) => e.lecturerId === l.id).length;
              return (
                <tr key={l.id}>
                  <th scope="row" className="sticky left-0 z-[1] border-b border-line bg-white px-3 py-2 text-left font-normal">
                    <div className="truncate text-[13px] font-medium text-ink">{l.name}</div>
                    <div className={cn("text-[11px]", count > SESSIONS_PER_LECTURER ? "font-semibold text-red-700" : "text-ink-muted")}>
                      {count} buổi/tuần
                    </div>
                  </th>
                  {DAYS.flatMap((_, day) =>
                    SLOTS.map((__, slot) => {
                      const items = byCell.get(`${l.id}:${day}:${slot}`) ?? [];
                      const target = editable && sel && sel.lecturerId === l.id && !(sel.day === day && sel.slot === slot);
                      return (
                        <td
                          key={`${day}-${slot}`}
                          className={cn(
                            "h-[84px] border-b border-l border-line p-1 align-top transition-colors",
                            slot === 0 && "border-l-line-strong",
                            target && "cursor-pointer bg-blue-50/70 hover:bg-blue-100",
                          )}
                          onClick={() => target && moveTo(sel.id, day, slot)}
                          onDragOver={(ev) => {
                            if (editable) ev.preventDefault();
                          }}
                          onDrop={(ev) => {
                            const id = ev.dataTransfer.getData("text/plain");
                            const e = entries.find((x) => x.id === id);
                            if (e && e.lecturerId === l.id) moveTo(id, day, slot);
                          }}
                        >
                          {items.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              draggable={editable}
                              onDragStart={(ev) => ev.dataTransfer.setData("text/plain", e.id)}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (editable) setSelected(selected === e.id ? null : e.id);
                              }}
                              title={`${e.subjectCode} ${e.subject} – Lớp ${e.classCode} – Phòng ${e.roomCode}${e.conflicts.length ? ` – ${e.conflicts.join(", ")}` : ""}`}
                              aria-pressed={selected === e.id}
                              aria-label={`${e.subject}, lớp ${e.classCode}, phòng ${e.roomCode}${e.locked ? ", đã khóa" : ""}${e.conflicts.length ? `, xung đột: ${e.conflicts.join(", ")}` : ""}`}
                              className={cn(
                                "mb-1 block w-full rounded-md border-l-[3px] px-1.5 py-1 text-left leading-tight transition-shadow",
                                editable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                                e.kind === "MD" ? "border-violet-500 bg-violet-50" : "border-blue-500 bg-blue-50",
                                e.conflicts.length > 0 && "bg-red-50 ring-2 ring-red-400",
                                selected === e.id && "ring-2 ring-action",
                              )}
                            >
                              <span className="flex items-center justify-between gap-1">
                                <span className="font-semibold break-all text-ink">{e.subjectCode}</span>
                                {e.locked && <Lock className="size-2.5 shrink-0 text-ink-muted" aria-hidden />}
                              </span>
                              <span className="block break-all text-ink-soft">Lớp {e.classCode}</span>
                              <span className="block break-all text-ink-soft">P. {e.roomCode}</span>
                              {e.outside && <span className="mt-0.5 block text-[10px] font-medium text-amber-700">Ngoài đăng ký</span>}
                            </button>
                          ))}
                        </td>
                      );
                    }),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

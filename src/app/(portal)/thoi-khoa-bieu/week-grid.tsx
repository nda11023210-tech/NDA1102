import { Lock } from "lucide-react";
import { DAYS, SLOTS, SUBJECT_KIND, slotTime } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { LoadedEntry } from "@/lib/timetable";

/** Lưới tuần (Thứ 2–6 × Sáng/Chiều) cho một giảng viên, lớp hoặc phòng */
export function WeekGrid({ entries, show }: { entries: LoadedEntry[]; show: "lecturer" | "class" | "room" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="w-20 border-b border-line bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold text-ink-muted uppercase">Buổi</th>
            {DAYS.map((d) => (
              <th key={d} className="border-b border-l border-line bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold text-ink-muted uppercase">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((s, slot) => (
            <tr key={s.label}>
              <th scope="row" className="border-b border-line px-3 py-3 text-left align-top text-xs font-semibold text-ink-soft">
                {s.label}
              </th>
              {DAYS.map((_, day) => {
                const items = entries.filter((e) => e.day === day && e.slot === slot);
                return (
                  <td key={day} className="h-28 border-b border-l border-line p-1.5 align-top">
                    <div className="space-y-1.5">
                      {items.map((e) => {
                        const kind = e.assignment.subject.kind;
                        return (
                          <div
                            key={e.id}
                            className={cn(
                              "rounded-lg border-l-[3px] px-2.5 py-2",
                              kind === "MD" ? "border-violet-500 bg-violet-50" : "border-blue-500 bg-blue-50",
                            )}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="text-[13px] leading-snug font-semibold text-ink">
                                <span className="font-mono">{e.assignment.subject.code}</span> · {e.assignment.subject.name}
                              </div>
                              {e.locked && <Lock className="mt-0.5 size-3 shrink-0 text-ink-muted" aria-label="Đã khóa" />}
                            </div>
                            <div className="mt-1 text-xs text-ink-muted">
                              {SUBJECT_KIND[kind].short} · {slotTime(slot, kind)}
                            </div>
                            <dl className="mt-1 space-y-0.5 text-xs text-ink-soft">
                              <div>
                                <dt className="inline text-ink-muted">Lớp: </dt>
                                <dd className="inline font-medium">
                                  {e.assignment.classGroup.code} – {e.assignment.classGroup.name}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline text-ink-muted">Phòng: </dt>
                                <dd className="inline font-medium">
                                  {e.room.code}
                                  {!e.room.name.includes(e.room.code) ? ` (${e.room.name})` : ""}
                                </dd>
                              </div>
                              {show !== "lecturer" && (
                                <div>
                                  <dt className="inline text-ink-muted">GV: </dt>
                                  <dd className="inline font-medium">{e.assignment.lecturer.name}</dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

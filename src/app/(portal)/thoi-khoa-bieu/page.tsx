import Link from "next/link";
import { CalendarRange, Sparkles, Send, Trash2, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTimetable } from "@/lib/permissions";
import { loadTimetable } from "@/lib/timetable";
import { SUBJECT_KIND } from "@/lib/constants";
import { cn, fmtDateTime } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PrintButton } from "@/components/print-button";
import { deleteTimetable, generateTimetable, publishTimetable, unpublishTimetable } from "./actions";
import { TimetableBoard, type BoardEntry } from "./board";
import { WeekGrid } from "./week-grid";

export const metadata = { title: "Thời khóa biểu" };

type SP = { tt?: string; view?: "khoa" | "gv" | "lop" | "phong"; id?: string };

export default async function TimetablePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const manager = canManageTimetable(user);
  const sp = await searchParams;

  const versions = await db.timetable.findMany({
    where: manager ? {} : { status: "PUBLISHED" },
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, status: true, createdAt: true, _count: { select: { entries: true } } },
  });
  const currentId = sp.tt ?? versions.find((v) => v.status === "PUBLISHED")?.id ?? versions[0]?.id;
  const tt = currentId ? await loadTimetable(currentId) : null;
  const view = sp.view ?? (manager ? "khoa" : "gv");

  const [lecturers, classes, rooms] = await Promise.all([
    // Giảng viên có buổi dạy trong phiên bản đang xem
    db.user.findMany({ where: { assignments: { some: { entries: { some: { timetableId: currentId ?? "" } } } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.classGroup.findMany({ orderBy: { code: "asc" } }),
    db.room.findMany({ orderBy: [{ type: "asc" }, { code: "asc" }] }),
  ]);

  const entityId = sp.id ?? (view === "gv" ? (lecturers.some((l) => l.id === user.id) ? user.id : lecturers[0]?.id) : view === "lop" ? classes[0]?.id : rooms[0]?.id);
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    Object.entries({ tt: currentId, view, id: undefined, ...patch }).forEach(([k, v]) => v && p.set(k, String(v)));
    return `/thoi-khoa-bieu?${p}`;
  };

  const header = (
    <PageHeader
      title="Thời khóa biểu"
      description={`Lịch giảng dạy Thứ 2 – Thứ 6, hai buổi Sáng/Chiều. Mô-đun (MĐ) học ${SUBJECT_KIND.MD.hours} giờ/buổi tại phòng thực hành; Môn học (MH) ${SUBJECT_KIND.MH.hours} giờ/buổi tại phòng lý thuyết. Mỗi giảng viên tối đa 5 buổi/tuần, ưu tiên môn đã đăng ký, chia đều và dạy trọn buổi sáng hoặc trọn buổi chiều.`}
      actions={<div className="no-print">{tt && <PrintButton label="In TKB" />}</div>}
    />
  );

  if (!tt) {
    return (
      <>
        {header}
        <Card>
          <EmptyState icon={CalendarRange} title={manager ? "Chưa có thời khóa biểu" : "Chưa có thời khóa biểu được công bố"}>
            {manager
              ? "Nhập Kế hoạch giảng dạy của lớp (mục Phân công & dữ liệu nền), nhắc giảng viên đăng ký môn dạy, rồi bấm “Xếp tự động”."
              : "Khoa sẽ công bố thời khóa biểu sớm. Trong lúc chờ, hãy vào “Đăng ký môn dạy” để chọn các môn bạn có thể dạy."}
          </EmptyState>
          {manager && (
            <ActionForm action={generateTimetable} className="flex justify-center">
              <SubmitButton pendingText="Đang xếp lịch…">
                <Sparkles className="size-4" aria-hidden /> Xếp tự động
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      </>
    );
  }

  const conflictTotal = tt.conflicts.size;
  const boardEntries: BoardEntry[] = tt.entries.map((e) => ({
    id: e.id,
    day: e.day,
    slot: e.slot,
    locked: e.locked,
    kind: e.assignment.subject.kind,
    subject: e.assignment.subject.name,
    subjectCode: e.assignment.subject.code,
    classCode: e.assignment.classGroup.code,
    roomId: e.roomId,
    roomCode: e.room.code,
    lecturerId: e.assignment.lecturerId,
    outside: e.assignment.outsideRegistration,
    conflicts: tt.conflicts.get(e.id) ?? [],
  }));
  const filtered =
    view === "gv"
      ? tt.entries.filter((e) => e.assignment.lecturerId === entityId)
      : view === "lop"
        ? tt.entries.filter((e) => e.assignment.classGroupId === entityId)
        : tt.entries.filter((e) => e.roomId === entityId);
  const myHours = tt.entries.filter((e) => e.assignment.lecturerId === entityId).reduce((a, e) => a + SUBJECT_KIND[e.assignment.subject.kind].hours, 0);

  return (
    <>
      {header}

      {manager && (
        <div className="no-print mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="card card-pad flex flex-col gap-3 xl:flex-row xl:items-center">
            <form action="/thoi-khoa-bieu" className="flex min-w-0 flex-1 items-center gap-2">
              <label htmlFor="tt-pick" className="text-sm font-medium whitespace-nowrap text-ink-soft">
                Phiên bản
              </label>
              <select id="tt-pick" name="tt" defaultValue={tt.id} className="input min-w-0 flex-1 sm:min-w-56">
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.status === "PUBLISHED" ? "● " : ""}
                    {v.name} ({v._count.entries} buổi)
                  </option>
                ))}
              </select>
              <button className="btn btn-secondary">Xem</button>
            </form>
            <div className="flex flex-wrap items-center gap-2">
              {tt.status === "PUBLISHED" ? (
                <>
                  <Badge tone="green">Đang công bố</Badge>
                  <form action={unpublishTimetable}>
                    <input type="hidden" name="id" value={tt.id} />
                    <SubmitButton className="btn btn-danger-soft" confirm="Hủy công bố thời khóa biểu này? Giảng viên sẽ không còn thấy lịch cho tới khi công bố lại.">
                      <Undo2 className="size-4" aria-hidden /> Hủy công bố
                    </SubmitButton>
                  </form>
                </>
              ) : (
                <form action={publishTimetable}>
                  <input type="hidden" name="id" value={tt.id} />
                  <SubmitButton className="btn btn-success" confirm={conflictTotal ? `Bản này còn ${conflictTotal} buổi xung đột. Vẫn công bố?` : undefined}>
                    <Send className="size-4" aria-hidden /> Công bố
                  </SubmitButton>
                </form>
              )}
              {tt.status !== "PUBLISHED" && (
                <form action={deleteTimetable}>
                  <input type="hidden" name="id" value={tt.id} />
                  <SubmitButton className="btn btn-danger-soft" confirm="Xóa phiên bản thời khóa biểu này?">
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">Xóa phiên bản</span>
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>
          <div className="card card-pad">
            <ActionForm action={generateTimetable} className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center">
              <input type="hidden" name="keepLockedFrom" value={tt.id} />
              <SubmitButton pendingText="Đang xếp lịch…">
                <Sparkles className="size-4" aria-hidden /> Xếp tự động (giữ buổi đã khóa)
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      )}

      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Chế độ xem" className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-200/60 p-1">
          {[
            ...(manager ? [["khoa", "Toàn Khoa"] as const] : []),
            ["gv", "Theo giảng viên"] as const,
            ["lop", "Theo lớp"] as const,
            ["phong", "Theo phòng"] as const,
          ].map(([v, label]) => (
            <Link key={v} href={href({ view: v })} className={cn("tab", view === v && "tab-active")}>
              {label}
            </Link>
          ))}
        </nav>
        {view !== "khoa" && (
          <form action="/thoi-khoa-bieu" className="flex gap-2">
            <input type="hidden" name="tt" value={tt.id} />
            <input type="hidden" name="view" value={view} />
            <label htmlFor="entity" className="sr-only">
              Chọn đối tượng
            </label>
            <select id="entity" name="id" defaultValue={entityId} className="input sm:w-72">
              {view === "gv" && lecturers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              {view === "lop" && classes.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
              {view === "phong" &&
                rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} – {r.type === "LAB" ? "Thực hành" : "Lý thuyết"}
                  </option>
                ))}
            </select>
            <button className="btn btn-secondary">Xem</button>
          </form>
        )}
      </div>

      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {tt.name}
            {tt.status === "PUBLISHED" && <Badge tone="green">Công bố</Badge>}
          </span>
        }
        actions={
          <span className="text-xs text-ink-muted">
            {view === "gv" && `${filtered.length} buổi · ${myHours} giờ/tuần · `}Cập nhật {fmtDateTime(tt.updatedAt)}
          </span>
        }
        bodyClassName=""
      >
        {view === "khoa" ? (
          <TimetableBoard entries={boardEntries} lecturers={lecturers} rooms={rooms.map((r) => ({ id: r.id, code: r.code, type: r.type }))} editable={manager} />
        ) : (
          <WeekGrid entries={filtered} show={view === "gv" ? "lecturer" : view === "lop" ? "class" : "room"} />
        )}
        <div className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-3 text-xs text-ink-muted sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm border-l-[3px] border-violet-500 bg-violet-50" aria-hidden /> Mô-đun (MĐ · 6 giờ)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm border-l-[3px] border-blue-500 bg-blue-50" aria-hidden /> Môn học (MH · 5 giờ)
          </span>
          {tt.note && manager && <span className="ml-auto">{tt.note}</span>}
        </div>
      </Card>
    </>
  );
}

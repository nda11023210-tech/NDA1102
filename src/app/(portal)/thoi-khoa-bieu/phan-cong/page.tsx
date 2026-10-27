import { Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { SESSIONS_PER_LECTURER, SUBJECT_KIND } from "@/lib/constants";
import { validateInput, type Kind, type RoomType } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { createAssignment, deleteAssignment, saveClassGroup, saveRoom, saveSubject, updateAssignmentSessions } from "../actions";

export const metadata = { title: "Phân công giảng dạy" };

export default async function AssignmentsPage() {
  await requireRole("HEAD", "ASSISTANT");
  const [lecturers, classes, subjects, rooms, assignments] = await Promise.all([
    db.user.findMany({ where: { active: true, role: { in: ["LECTURER", "HEAD", "ASSISTANT"] } }, orderBy: { name: "asc" } }),
    db.classGroup.findMany({ orderBy: { code: "asc" }, include: { assignments: { select: { sessionsPerWeek: true } } } }),
    db.subject.findMany({ orderBy: { code: "asc" } }),
    db.room.findMany({ orderBy: [{ type: "asc" }, { code: "asc" }] }),
    db.teachingAssignment.findMany({ include: { lecturer: true, classGroup: true, subject: true }, orderBy: [{ lecturer: { name: "asc" } }] }),
  ]);

  const issues = validateInput({
    assignments: assignments.map((a) => ({ id: a.id, lecturerId: a.lecturerId, classGroupId: a.classGroupId, kind: a.subject.kind as Kind, sessionsPerWeek: a.sessionsPerWeek })),
    rooms: rooms.map((r) => ({ id: r.id, type: r.type as RoomType })),
    requiredPerLecturer: SESSIONS_PER_LECTURER,
    lecturerNames: Object.fromEntries(lecturers.map((l) => [l.id, l.name])),
    classNames: Object.fromEntries(classes.map((c) => [c.id, c.code])),
  });

  const byLecturer = lecturers
    .map((l) => ({ lecturer: l, items: assignments.filter((a) => a.lecturerId === l.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        title="Phân công giảng dạy & dữ liệu nền"
        description={`Thuật toán xếp lịch dùng dữ liệu này. Điều kiện: mỗi giảng viên có tổng đúng ${SESSIONS_PER_LECTURER} buổi/tuần; mỗi phân công tối đa 5 buổi (1 buổi/ngày).`}
      />

      <div className={cn("mb-6 flex items-start gap-3 rounded-xl px-4 py-3 text-sm", issues.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800")} role="status">
        {issues.length ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
        {issues.length ? (
          <div>
            <div className="font-semibold">Dữ liệu chưa đủ điều kiện xếp lịch ({issues.length} vấn đề):</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ) : (
          <span>Dữ liệu hợp lệ – sẵn sàng xếp thời khóa biểu tự động ({assignments.reduce((a, x) => a + x.sessionsPerWeek, 0)} buổi/tuần).</span>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card title="Phân công theo giảng viên" bodyClassName="divide-y divide-line">
          {byLecturer.map(({ lecturer, items }) => {
            const total = items.reduce((a, x) => a + x.sessionsPerWeek, 0);
            return (
              <div key={lecturer.id} className="px-5 py-4 sm:px-6">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-semibold">{lecturer.name}</div>
                  <Badge tone={total === SESSIONS_PER_LECTURER ? "green" : "red"}>
                    {total}/{SESSIONS_PER_LECTURER} buổi
                  </Badge>
                </div>
                <ul className="space-y-1.5">
                  {items.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone={a.subject.kind === "MD" ? "violet" : "blue"}>{SUBJECT_KIND[a.subject.kind].short}</Badge>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{a.subject.name}</span> <span className="text-ink-muted">· {a.classGroup.code}</span>
                      </span>
                      <form action={updateAssignmentSessions} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={a.id} />
                        <label htmlFor={`s-${a.id}`} className="sr-only">
                          Số buổi/tuần
                        </label>
                        <select id={`s-${a.id}`} name="sessionsPerWeek" defaultValue={a.sessionsPerWeek} className="input min-h-8 w-[88px] py-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n} buổi
                            </option>
                          ))}
                        </select>
                        <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">
                          Lưu
                        </SubmitButton>
                      </form>
                      <form action={deleteAssignment}>
                        <input type="hidden" name="id" value={a.id} />
                        <SubmitButton className="btn btn-ghost btn-sm text-red-600" confirm="Xóa phân công này? Các buổi đã xếp tương ứng cũng bị xóa.">
                          <Trash2 className="size-4" aria-label="Xóa phân công" />
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Card>

        <div className="space-y-6">
          <Card title="Thêm phân công">
            <ActionForm action={createAssignment}>
              <Field label="Giảng viên" htmlFor="lecturerId" required>
                <select id="lecturerId" name="lecturerId" required className="input">
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lớp" htmlFor="classGroupId" required>
                <select id="classGroupId" name="classGroupId" required className="input">
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} ({c.assignments.reduce((a, x) => a + x.sessionsPerWeek, 0)}/10 buổi)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Học phần" htmlFor="subjectId" required>
                <select id="subjectId" name="subjectId" required className="input">
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{SUBJECT_KIND[s.kind].short}] {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Số buổi/tuần" htmlFor="sessionsPerWeek" required>
                <input id="sessionsPerWeek" name="sessionsPerWeek" type="number" min={1} max={5} defaultValue={2} className="input" />
              </Field>
              <SubmitButton>Thêm phân công</SubmitButton>
            </ActionForm>
          </Card>

          <Disclosure summary={`Phòng học (${rooms.length})`}>
            <ul className="mb-4 flex flex-wrap gap-1.5">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Badge tone={r.type === "LAB" ? "violet" : "blue"}>
                    {r.code} · {r.type === "LAB" ? "TH" : "LT"}
                  </Badge>
                </li>
              ))}
            </ul>
            <ActionForm action={saveRoom}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mã phòng" htmlFor="room-code" required>
                  <input id="room-code" name="code" required className="input uppercase" />
                </Field>
                <Field label="Loại" htmlFor="room-type">
                  <select id="room-type" name="type" className="input">
                    <option value="THEORY">Lý thuyết</option>
                    <option value="LAB">Thực hành</option>
                  </select>
                </Field>
                <Field label="Tên" htmlFor="room-name">
                  <input id="room-name" name="name" className="input" />
                </Field>
                <Field label="Sức chứa" htmlFor="room-cap">
                  <input id="room-cap" name="capacity" type="number" className="input" defaultValue={40} />
                </Field>
              </div>
              <SubmitButton className="btn btn-secondary">Lưu phòng</SubmitButton>
            </ActionForm>
          </Disclosure>

          <Disclosure summary={`Lớp học (${classes.length})`}>
            <ul className="mb-4 flex flex-wrap gap-1.5">
              {classes.map((c) => (
                <li key={c.id}>
                  <Badge>{c.code}</Badge>
                </li>
              ))}
            </ul>
            <ActionForm action={saveClassGroup}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mã lớp" htmlFor="cls-code" required>
                  <input id="cls-code" name="code" required className="input uppercase" />
                </Field>
                <Field label="Sĩ số" htmlFor="cls-size">
                  <input id="cls-size" name="size" type="number" className="input" defaultValue={35} />
                </Field>
              </div>
              <Field label="Tên lớp" htmlFor="cls-name">
                <input id="cls-name" name="name" className="input" />
              </Field>
              <SubmitButton className="btn btn-secondary">Lưu lớp</SubmitButton>
            </ActionForm>
          </Disclosure>

          <Disclosure summary={`Học phần (${subjects.length})`}>
            <ul className="mb-4 space-y-1 text-sm">
              {subjects.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Badge tone={s.kind === "MD" ? "violet" : "blue"}>{SUBJECT_KIND[s.kind].short}</Badge>
                  <span className="font-mono text-xs">{s.code}</span> {s.name}
                </li>
              ))}
            </ul>
            <ActionForm action={saveSubject}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mã" htmlFor="sub-code" required>
                  <input id="sub-code" name="code" required className="input uppercase" />
                </Field>
                <Field label="Loại" htmlFor="sub-kind">
                  <select id="sub-kind" name="kind" className="input">
                    <option value="MD">Mô-đun (6 giờ/buổi)</option>
                    <option value="MH">Môn học (5 giờ/buổi)</option>
                  </select>
                </Field>
              </div>
              <Field label="Tên học phần" htmlFor="sub-name" required>
                <input id="sub-name" name="name" required className="input" />
              </Field>
              <Field label="Tổng số giờ" htmlFor="sub-hours">
                <input id="sub-hours" name="hours" type="number" className="input" defaultValue={60} />
              </Field>
              <SubmitButton className="btn btn-secondary">Lưu học phần</SubmitButton>
            </ActionForm>
          </Disclosure>
        </div>
      </div>
    </>
  );
}

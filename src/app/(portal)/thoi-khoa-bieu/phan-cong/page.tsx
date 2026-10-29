import { Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { isAdmin, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { SUBJECT_KIND } from "@/lib/constants";
import { allocateLecturers, MAX_PER_LECTURER, validateInput, type Kind, type RoomType } from "@/lib/scheduler";
import { loadPlanInput } from "@/lib/timetable";
import { cn } from "@/lib/utils";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";
import { DeleteButton } from "@/components/delete-button";
import {
  createAssignment,
  deleteAssignment,
  deleteClassGroup,
  deleteClassSubject,
  deleteRoom,
  deleteSubject,
  saveClassGroup,
  saveClassSubject,
  saveRoom,
  saveSubject,
} from "../actions";

export const metadata = { title: "Phân công giảng dạy" };

export default async function AssignmentsPage() {
  const user = await requireRole("MANAGER");
  const admin = isAdmin(user); // xóa dữ liệu: chỉ Quản trị viên
  const [staff, classes, subjects, rooms, fixed, plans, prefs, planInput] = await Promise.all([
    db.user.findMany({ where: { active: true, role: { not: "ADMIN" } }, orderBy: { name: "asc" } }),
    db.classGroup.findMany({ orderBy: { code: "asc" } }),
    db.subject.findMany({ orderBy: [{ kind: "asc" }, { code: "asc" }] }),
    db.room.findMany({ orderBy: [{ type: "asc" }, { code: "asc" }] }),
    db.teachingAssignment.findMany({ where: { timetableId: null }, include: { lecturer: true, classGroup: true, subject: true }, orderBy: [{ lecturer: { name: "asc" } }] }),
    db.classSubject.findMany({ include: { subject: true }, orderBy: { subject: { code: "asc" } } }),
    db.teachingPreference.findMany({ include: { user: { select: { id: true, name: true } } } }),
    loadPlanInput(),
  ]);

  // Xem trước kết quả phân bổ giảng viên (giai đoạn 1 của thuật toán)
  const preview = allocateLecturers({ demands: planInput.demands, fixed: planInput.fixed, lecturers: planInput.lecturers, rooms: planInput.rooms, seed: 1 });
  const fixedIssues = validateInput({
    assignments: fixed.map((a) => ({ id: a.id, lecturerId: a.lecturerId, classGroupId: a.classGroupId, kind: a.subject.kind as Kind, sessionsPerWeek: a.sessionsPerWeek })),
    rooms: rooms.map((r) => ({ id: r.id, type: r.type as RoomType })),
    lecturerNames: Object.fromEntries(staff.map((l) => [l.id, l.name])),
    classNames: Object.fromEntries(classes.map((c) => [c.id, c.code])),
  });
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));
  const subjectOf = new Map(subjects.map((s) => [s.id, s]));
  const classOf = new Map(classes.map((c) => [c.id, c]));
  const totalDemand = plans.reduce((a, p) => a + p.sessionsPerWeek, 0);
  const unassignedTotal = preview.unassigned.reduce((a, u) => a + u.sessions, 0);
  const loadRows = Object.entries(preview.loads)
    .map(([id, n]) => ({
      id,
      n,
      outside: preview.allocations.filter((a) => a.lecturerId === id && a.outsideRegistration).reduce((s, a) => s + a.sessions, 0),
      regCount: prefs.filter((p) => p.userId === id).length,
    }))
    .sort((a, b) => (nameOf.get(a.id) ?? "").localeCompare(nameOf.get(b.id) ?? "", "vi"));
  const loads = loadRows.map((r) => r.n);
  const spread = loads.length ? Math.max(...loads) - Math.min(...loads) : 0;
  const issues = [...fixedIssues, ...preview.unassigned.map((u) => `Thiếu ${u.sessions} buổi ${subjectOf.get(u.subjectId)?.code} lớp ${classOf.get(u.classGroupId)?.code}: ${u.reason}.`)];

  return (
    <>
      <PageHeader
        title="Phân công & dữ liệu nền"
        description="Nhập kế hoạch giảng dạy của từng lớp; thuật toán tự chọn giảng viên (ưu tiên người đã đăng ký môn, chia đều tối đa 5 buổi/người) rồi xếp lịch. Phân công cố định chỉ dùng khi muốn chỉ định đích danh."
      />

      {/* ───── Dự kiến phân bổ ───── */}
      <Card title="Dự kiến phân bổ giảng viên" className="mb-6" actions={<span className="text-xs text-ink-muted">Kết quả thực tế có thể khác chút do xếp lịch ngẫu nhiên</span>}>
        <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Tổng buổi theo kế hoạch", `${totalDemand} buổi/tuần`],
            ["Giảng viên tham gia", `${loadRows.length} người · tối đa ${loadRows.length * MAX_PER_LECTURER} buổi`],
            ["Mức chia đều", `${preview.target} buổi/người · chênh lệch ${spread}`],
            ["Ngoài môn đăng ký", `${preview.outsideRegistrationSessions} buổi`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="text-xs text-ink-muted">{k}</div>
              <div className="font-semibold text-ink">{v}</div>
            </div>
          ))}
        </div>
        <div className={cn("mb-4 flex items-start gap-3 rounded-xl px-4 py-3 text-sm", issues.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800")} role="status">
          {issues.length ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {issues.length ? (
            <div>
              <div className="font-semibold">Cần lưu ý ({issues.length}){unassignedTotal ? ` – ${unassignedTotal} buổi chưa xếp được` : ""}:</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {issues.slice(0, 8).map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ) : (
            <span>Toàn bộ kế hoạch đều có giảng viên nhận – sẵn sàng xếp thời khóa biểu.</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[620px]">
            <thead>
              <tr>
                <th>Giảng viên</th>
                <th className="text-right">Số môn đăng ký</th>
                <th className="text-right">Dự kiến (buổi/tuần)</th>
                <th className="text-right">Ngoài đăng ký</th>
              </tr>
            </thead>
            <tbody>
              {loadRows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{nameOf.get(r.id)}</td>
                  <td className={cn("text-right tabular-nums", r.regCount === 0 && "font-semibold text-amber-700")}>{r.regCount === 0 ? "Chưa đăng ký" : r.regCount}</td>
                  <td className="text-right font-semibold tabular-nums">{r.n}</td>
                  <td className="text-right tabular-nums">{r.outside ? <Badge tone="amber">{r.outside} buổi</Badge> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          {/* ───── Kế hoạch giảng dạy của lớp ───── */}
          <Card title="Kế hoạch giảng dạy của lớp" bodyClassName="divide-y divide-line">
            {classes.length === 0 && <p className="px-6 py-8 text-center text-sm text-ink-muted">Chưa có lớp. Thêm lớp ở khung bên phải.</p>}
            {classes.map((c) => {
              const items = plans.filter((p) => p.classGroupId === c.id);
              const total = items.reduce((a, p) => a + p.sessionsPerWeek, 0);
              return (
                <div key={c.id} className="px-5 py-4 sm:px-6">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="font-semibold">
                      {c.code} <span className="text-sm font-normal text-ink-muted">– {c.name}</span>
                    </div>
                    <Badge tone={total > 10 ? "red" : total === 0 ? "slate" : "blue"}>{total}/10 buổi</Badge>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-sm text-ink-muted">Chưa có môn nào.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {items.map((p) => {
                        const regs = prefs.filter((x) => x.subjectId === p.subjectId).length;
                        return (
                          <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge tone={p.subject.kind === "MD" ? "violet" : "blue"}>{SUBJECT_KIND[p.subject.kind].short}</Badge>
                            <span className="min-w-0 flex-1">
                              <span className="font-mono text-xs">{p.subject.code}</span> <span className="font-medium">{p.subject.name}</span>
                              {regs === 0 && <span className="ml-2 text-xs font-medium text-amber-700">· chưa ai đăng ký</span>}
                            </span>
                            <span className="text-ink-muted tabular-nums">{p.sessionsPerWeek} buổi/tuần</span>
                            {admin && (
                            <form action={deleteClassSubject}>
                              <input type="hidden" name="id" value={p.id} />
                              <SubmitButton className="btn btn-ghost btn-sm text-red-600" confirm={`Bỏ ${p.subject.name} khỏi kế hoạch lớp ${c.code}?`}>
                                <Trash2 className="size-4" aria-hidden />
                                <span className="sr-only">Bỏ khỏi kế hoạch</span>
                              </SubmitButton>
                            </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </Card>

          {/* ───── Đăng ký môn dạy ───── */}
          <Card title="Đăng ký môn dạy của giảng viên" bodyClassName="overflow-x-auto">
            <table className="table min-w-[620px]">
              <thead>
                <tr>
                  <th>Học phần</th>
                  <th>Người đã đăng ký</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => {
                  const who = prefs.filter((p) => p.subjectId === s.id);
                  const needed = plans.some((p) => p.subjectId === s.id);
                  return (
                    <tr key={s.id}>
                      <td>
                        <span className="font-mono text-xs">{s.code}</span> <span className="font-medium">{s.name}</span>
                      </td>
                      <td>
                        {who.length ? (
                          <span className="flex flex-wrap gap-1">
                            {who.map((w) => (
                              <Badge key={w.id}>{w.user.name}</Badge>
                            ))}
                          </span>
                        ) : (
                          <span className={cn("text-sm", needed ? "font-medium text-amber-700" : "text-ink-muted")}>{needed ? "Chưa ai đăng ký (đang có lớp cần học)" : "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* ───── Phân công cố định ───── */}
          <Disclosure summary={`Phân công cố định – tùy chọn (${fixed.length})`}>
            <p className="mb-4 text-sm text-ink-muted">
              Dùng khi cần chỉ định đích danh một giảng viên cho một lớp–môn. Thuật toán giữ nguyên các phân công này và chỉ phân bổ phần còn lại. Mỗi giảng viên tối đa {MAX_PER_LECTURER} buổi/tuần.
            </p>
            {fixed.length > 0 && (
              <ul className="mb-5 space-y-1.5">
                {fixed.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={a.subject.kind === "MD" ? "violet" : "blue"}>{SUBJECT_KIND[a.subject.kind].short}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{a.lecturer.name}</span> · {a.subject.code} {a.subject.name} · {a.classGroup.code} · {a.sessionsPerWeek} buổi
                    </span>
                    {admin && (
                    <form action={deleteAssignment}>
                      <input type="hidden" name="id" value={a.id} />
                      <SubmitButton className="btn btn-ghost btn-sm text-red-600" confirm="Xóa phân công cố định này?">
                        <Trash2 className="size-4" aria-hidden />
                        <span className="sr-only">Xóa phân công</span>
                      </SubmitButton>
                    </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={createAssignment} className="grid gap-3 space-y-0 sm:grid-cols-2">
              <Field label="Giảng viên" htmlFor="lecturerId" required>
                <select id="lecturerId" name="lecturerId" required className="input">
                  {staff.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lớp" htmlFor="fx-class" required>
                <select id="fx-class" name="classGroupId" required className="input">
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Học phần" htmlFor="fx-subject" required>
                <select id="fx-subject" name="subjectId" required className="input">
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{SUBJECT_KIND[s.kind].short}] {s.code} {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Số buổi/tuần" htmlFor="fx-sessions" required>
                <input id="fx-sessions" name="sessionsPerWeek" type="number" min={1} max={5} defaultValue={2} className="input" />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton className="btn btn-secondary">Thêm phân công cố định</SubmitButton>
              </div>
            </ActionForm>
          </Disclosure>
        </div>

        <div className="space-y-6">
          <Card title="Thêm môn vào kế hoạch lớp">
            <ActionForm action={saveClassSubject}>
              <Field label="Lớp" htmlFor="cs-class" required>
                <select id="cs-class" name="classGroupId" required className="input">
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} ({plans.filter((p) => p.classGroupId === c.id).reduce((a, p) => a + p.sessionsPerWeek, 0)}/10 buổi)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Học phần" htmlFor="cs-subject" required>
                <select id="cs-subject" name="subjectId" required className="input">
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{SUBJECT_KIND[s.kind].short}] {s.code} {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Số buổi/tuần" htmlFor="cs-sessions" hint="Nếu môn đã có trong kế hoạch lớp, số buổi sẽ được cập nhật." required>
                <input id="cs-sessions" name="sessionsPerWeek" type="number" min={1} max={5} defaultValue={2} className="input" />
              </Field>
              <SubmitButton>Lưu vào kế hoạch</SubmitButton>
            </ActionForm>
          </Card>

          <Disclosure summary={`Phòng học (${rooms.length})`}>
            <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
              {rooms.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                  <span>
                    <span className="font-medium">{r.code}</span> <span className="text-ink-muted">· {r.type === "LAB" ? "Thực hành" : "Lý thuyết"} · {r.capacity} chỗ</span>
                  </span>
                  {admin && <DeleteButton action={deleteRoom} id={r.id} label={`Xóa phòng ${r.code}`} confirm={`Xóa phòng ${r.code}?`} />}
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
            <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
              {classes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                  <span>
                    <span className="font-medium">{c.code}</span> <span className="text-ink-muted">· {c.size} SV</span>
                  </span>
                  {admin && <DeleteButton action={deleteClassGroup} id={c.id} label={`Xóa lớp ${c.code}`} confirm={`Xóa lớp ${c.code}? Kế hoạch giảng dạy và phân công cố định của lớp cũng bị xóa.`} />}
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
            <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
              {subjects.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0">
                    <Badge tone={s.kind === "MD" ? "violet" : "blue"}>{SUBJECT_KIND[s.kind].short}</Badge> <span className="font-mono text-xs">{s.code}</span> {s.name}
                  </span>
                  {admin && (
                  <DeleteButton
                    action={deleteSubject}
                    id={s.id}
                    label={`Xóa học phần ${s.code}`}
                    confirm={`Xóa học phần ${s.code} ${s.name}? Kế hoạch, phân công cố định và đăng ký môn liên quan cũng bị xóa.`}
                  />
                  )}
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

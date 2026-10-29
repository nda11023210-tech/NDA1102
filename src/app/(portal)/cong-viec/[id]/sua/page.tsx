import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { TASK_PRIORITY } from "@/lib/constants";
import { fmtSize, toLocalInput } from "@/lib/utils";
import { Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DeleteButton } from "@/components/delete-button";
import { deleteTask, updateTask } from "../../actions";

export const metadata = { title: "Sửa công việc" };

export default async function EditTask({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("ADMIN");
  const [task, staff] = await Promise.all([
    db.task.findUnique({ where: { id }, include: { attachments: true } }),
    db.user.findMany({ where: { active: true, role: { not: "ADMIN" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!task) notFound();

  return (
    <>
      <PageHeader
        title="Sửa công việc"
        back={{ href: `/cong-viec/${task.id}`, label: task.title }}
        actions={
          <DeleteButton
            action={deleteTask}
            id={task.id}
            fields={{ from: "detail" }}
            text="Xóa công việc"
            label={`Xóa công việc ${task.title}`}
            confirm={`Xóa công việc “${task.title}” cùng trao đổi và tệp đính kèm?`}
          />
        }
      />
      <Card className="max-w-4xl">
        <ActionForm action={updateTask} resetOnSuccess={false} className="grid gap-4 space-y-0 lg:grid-cols-2">
          <input type="hidden" name="id" value={task.id} />
          <div className="space-y-4">
            <Field label="Tên công việc" htmlFor="title" required>
              <input id="title" name="title" required defaultValue={task.title} className="input" />
            </Field>
            <Field label="Mô tả" htmlFor="description">
              <textarea id="description" name="description" rows={4} defaultValue={task.description ?? ""} className="input" />
            </Field>
            <Field label="Tiêu chí nghiệm thu" htmlFor="criteria" hint="Mỗi dòng một tiêu chí.">
              <textarea id="criteria" name="criteria" rows={4} defaultValue={task.criteria ?? ""} className="input" />
            </Field>
          </div>
          <div className="space-y-4">
            <Field label="Người thực hiện" htmlFor="assigneeId" required>
              <select id="assigneeId" name="assigneeId" required defaultValue={task.assigneeId} className="input">
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Hạn chót" htmlFor="dueAt" required>
                <input id="dueAt" name="dueAt" type="datetime-local" required defaultValue={toLocalInput(task.dueAt)} className="input" />
              </Field>
              <Field label="Ưu tiên" htmlFor="priority">
                <select id="priority" name="priority" defaultValue={task.priority} className="input">
                  {Object.entries(TASK_PRIORITY).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Khối lượng" htmlFor="workload">
                <select id="workload" name="workload" defaultValue={String(task.workload)} className="input">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} – {["Rất nhỏ", "Nhỏ", "Vừa", "Lớn", "Rất lớn"][n - 1]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {task.attachments.length > 0 && (
              <fieldset className="rounded-xl border border-line p-4">
                <legend className="px-1 text-sm font-medium text-ink-soft">Tệp đính kèm – tích để gỡ bỏ</legend>
                <ul className="space-y-1.5">
                  {task.attachments.map((a) => (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" name="removeAttachment" value={a.id} className="size-4 accent-red-600" />
                        <span className="font-medium">{a.fileName}</span>
                        <span className="text-xs text-ink-muted">{fmtSize(a.size)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
            <Field label="Thêm tệp" htmlFor="files">
              <input id="files" name="files" type="file" multiple className="input" />
            </Field>
            <SubmitButton>Lưu thay đổi</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}

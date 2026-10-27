import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { ROLES, ROLE_LABEL, normalizeRole, type Role } from "@/lib/constants";
import { str } from "@/lib/utils";
import { Avatar, Badge, Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, Disclosure, SubmitButton } from "@/components/forms";

export const metadata = { title: "Người dùng" };

async function createUser(_: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  return attempt(async () => {
    await requireRole("ADMIN");
    const email = str(fd, "email").toLowerCase();
    const name = str(fd, "name");
    const role = str(fd, "role") as Role;
    const password = str(fd, "password");
    if (!email || !name) return fail("Vui lòng nhập họ tên và email.");
    if (!ROLES.includes(role)) return fail("Vai trò không hợp lệ.");
    if (password.length < 8) return fail("Mật khẩu ban đầu cần tối thiểu 8 ký tự.");
    if (await db.user.findUnique({ where: { email } })) return fail("Email đã tồn tại trong hệ thống.");
    await db.user.create({
      data: { email, name, role, title: str(fd, "title") || null, expertise: str(fd, "expertise") || null, passwordHash: await bcrypt.hash(password, 10) },
    });
    revalidatePath("/nguoi-dung");
    return ok(`Đã tạo tài khoản cho ${name}.`);
  });
}

async function updateUser(fd: FormData) {
  "use server";
  const admin = await requireRole("ADMIN");
  const id = str(fd, "id");
  const intent = str(fd, "intent");
  if (intent === "role") {
    const role = str(fd, "role") as Role;
    if (ROLES.includes(role) && id !== admin.id) await db.user.update({ where: { id }, data: { role } });
  } else if (intent === "toggle" && id !== admin.id) {
    const u = await db.user.findUniqueOrThrow({ where: { id } });
    await db.user.update({ where: { id }, data: { active: !u.active } });
  } else if (intent === "reset") {
    const pw = process.env.SEED_PASSWORD || "Kcntt@2026";
    await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(pw, 10) } });
  }
  revalidatePath("/nguoi-dung");
}

export default async function UsersPage() {
  const me = await requireRole("ADMIN");
  const users = await db.user.findMany({ orderBy: [{ name: "asc" }] });

  return (
    <>
      <PageHeader title="Người dùng" description={`${users.length} tài khoản. Phân quyền theo vai trò: Quản trị viên, Quản lý khoa, Giảng viên.`} />

      <Disclosure summary="Thêm tài khoản mới" className="mb-6">
        <ActionForm action={createUser} className="grid gap-4 space-y-0 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Họ và tên" htmlFor="name" required>
            <input id="name" name="name" required className="input" />
          </Field>
          <Field label="Email" htmlFor="email" required>
            <input id="email" name="email" type="email" required className="input" />
          </Field>
          <Field label="Vai trò" htmlFor="role" required>
            <select id="role" name="role" className="input" defaultValue="LECTURER">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Học hàm/học vị" htmlFor="title">
            <input id="title" name="title" className="input" placeholder="ThS." />
          </Field>
          <Field label="Chuyên môn" htmlFor="expertise">
            <input id="expertise" name="expertise" className="input" />
          </Field>
          <Field label="Mật khẩu ban đầu" htmlFor="password" required>
            <input id="password" name="password" type="text" required minLength={8} className="input" autoComplete="off" />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <SubmitButton>Tạo tài khoản</SubmitButton>
          </div>
        </ActionForm>
      </Disclosure>

      <Card bodyClassName="overflow-x-auto">
        {users.length > 0 && (
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium">
                          {u.title ? `${u.title} ` : ""}
                          {u.name}
                        </div>
                        <div className="text-xs text-ink-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <form action={updateUser} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="intent" value="role" />
                      <label className="sr-only" htmlFor={`role-${u.id}`}>
                        Vai trò của {u.name}
                      </label>
                      <select id={`role-${u.id}`} name="role" defaultValue={normalizeRole(u.role)} className="input min-h-8 w-40 py-1" disabled={u.id === me.id}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                      {u.id !== me.id && <SubmitButton className="btn btn-secondary btn-sm" pendingText="…">Lưu</SubmitButton>}
                    </form>
                  </td>
                  <td>{u.active ? <Badge tone="green">Hoạt động</Badge> : <Badge tone="red">Đã khóa</Badge>}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <form action={updateUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="intent" value="reset" />
                        <SubmitButton className="btn btn-ghost btn-sm" confirm={`Đặt lại mật khẩu của ${u.name} về mật khẩu mặc định?`}>
                          Đặt lại MK
                        </SubmitButton>
                      </form>
                      {u.id !== me.id && (
                        <form action={updateUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="intent" value="toggle" />
                          <SubmitButton className={u.active ? "btn btn-danger-soft btn-sm" : "btn btn-secondary btn-sm"}>
                            {u.active ? "Khóa" : "Mở khóa"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

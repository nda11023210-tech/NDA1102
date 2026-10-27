import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { ROLE_LABEL } from "@/lib/constants";
import { str } from "@/lib/utils";
import { Avatar, Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Tài khoản" };

async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  return attempt(async () => {
    const user = await requireUser();
    const current = str(fd, "current");
    const next = str(fd, "next");
    if (next.length < 8) return fail("Mật khẩu mới cần tối thiểu 8 ký tự.");
    if (next !== str(fd, "confirm")) return fail("Xác nhận mật khẩu không khớp.");
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await bcrypt.compare(current, row.passwordHash))) return fail("Mật khẩu hiện tại không đúng.");
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
    return ok("Đã đổi mật khẩu thành công.");
  });
}

async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  return attempt(async () => {
    const user = await requireUser();
    await db.user.update({
      where: { id: user.id },
      data: { phone: str(fd, "phone") || null, expertise: str(fd, "expertise") || null },
    });
    return ok("Đã cập nhật thông tin.");
  });
}

export default async function AccountPage() {
  const me = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });

  return (
    <>
      <PageHeader title="Tài khoản của tôi" description="Thông tin cá nhân và bảo mật đăng nhập." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Thông tin cá nhân">
          <div className="mb-5 flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div>
              <div className="font-semibold">
                {user.title ? `${user.title} ` : ""}
                {user.name}
              </div>
              <div className="text-sm text-ink-muted">
                {user.email} · {ROLE_LABEL[me.role]}
              </div>
            </div>
          </div>
          <ActionForm action={updateProfile} resetOnSuccess={false}>
            <Field label="Số điện thoại" htmlFor="phone">
              <input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} className="input" autoComplete="tel" />
            </Field>
            <Field label="Chuyên môn" htmlFor="expertise" hint="Dùng để gợi ý phân công giảng dạy và giao việc.">
              <input id="expertise" name="expertise" defaultValue={user.expertise ?? ""} className="input" />
            </Field>
            <SubmitButton>Lưu thay đổi</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="Đổi mật khẩu">
          <ActionForm action={changePassword}>
            <Field label="Mật khẩu hiện tại" htmlFor="current" required>
              <input id="current" name="current" type="password" required className="input" autoComplete="current-password" />
            </Field>
            <Field label="Mật khẩu mới" htmlFor="next" hint="Tối thiểu 8 ký tự." required>
              <input id="next" name="next" type="password" required minLength={8} className="input" autoComplete="new-password" />
            </Field>
            <Field label="Nhập lại mật khẩu mới" htmlFor="confirm" required>
              <input id="confirm" name="confirm" type="password" required className="input" autoComplete="new-password" />
            </Field>
            <SubmitButton className="btn btn-brand">Đổi mật khẩu</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}

import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES, ROLE_LABEL, normalizeRole } from "@/lib/constants";
import { fmtDateTime } from "@/lib/utils";
import { Avatar, Badge, Card, Field, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DeleteButton } from "@/components/delete-button";
import { deleteUser, updateUserInfo } from "../actions";

export const metadata = { title: "Sửa người dùng" };

export default async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireRole("ADMIN");
  const u = await db.user.findUnique({ where: { id } });
  if (!u) notFound();
  const self = u.id === me.id;

  return (
    <>
      <PageHeader
        title="Sửa tài khoản"
        back={{ href: "/nguoi-dung", label: "Người dùng" }}
        actions={
          !self && (
            <DeleteButton
              action={deleteUser}
              id={u.id}
              fields={{ from: "detail" }}
              text="Xóa tài khoản"
              label={`Xóa tài khoản ${u.name}`}
              confirm={`Xóa vĩnh viễn tài khoản ${u.name}? (Chỉ xóa được tài khoản chưa phát sinh dữ liệu; nếu đã có dữ liệu, hệ thống sẽ đề nghị Khóa.)`}
            />
          )
        }
      />
      <Card className="max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={u.name} size="lg" />
          <div>
            <div className="font-semibold">{u.name}</div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              {u.email} · {ROLE_LABEL[normalizeRole(u.role)]}
              {u.active ? <Badge tone="green">Hoạt động</Badge> : <Badge tone="red">Đã khóa</Badge>}
              <span>· Tạo lúc {fmtDateTime(u.createdAt)}</span>
            </div>
          </div>
        </div>
        <ActionForm action={updateUserInfo} resetOnSuccess={false} className="grid gap-4 space-y-0 sm:grid-cols-2">
          <input type="hidden" name="id" value={u.id} />
          <Field label="Họ và tên" htmlFor="name" required>
            <input id="name" name="name" required defaultValue={u.name} className="input" />
          </Field>
          <Field label="Email đăng nhập" htmlFor="email" required>
            <input id="email" name="email" type="email" required defaultValue={u.email} className="input" />
          </Field>
          <Field label="Vai trò" htmlFor="role" hint={self ? "Không thể tự đổi vai trò của chính mình." : undefined}>
            <select id="role" name="role" defaultValue={normalizeRole(u.role)} disabled={self} className="input">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {self && <input type="hidden" name="role" value={normalizeRole(u.role)} />}
          </Field>
          <Field label="Học hàm/học vị" htmlFor="title">
            <input id="title" name="title" defaultValue={u.title ?? ""} className="input" placeholder="ThS." />
          </Field>
          <Field label="Số điện thoại" htmlFor="phone">
            <input id="phone" name="phone" type="tel" defaultValue={u.phone ?? ""} className="input" />
          </Field>
          <Field label="Chuyên môn" htmlFor="expertise">
            <input id="expertise" name="expertise" defaultValue={u.expertise ?? ""} className="input" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Lưu thay đổi</SubmitButton>
          </div>
        </ActionForm>
        <p className="mt-6 text-xs text-ink-muted">Đổi mật khẩu: dùng nút “Đặt lại MK” ở danh sách người dùng (về mật khẩu mặc định), người dùng tự đổi lại trong mục Tài khoản.</p>
      </Card>
    </>
  );
}

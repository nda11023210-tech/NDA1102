import { BookCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SUBJECT_KIND } from "@/lib/constants";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { saveTeachingPreferences } from "../actions";

export const metadata = { title: "Đăng ký môn dạy" };

export default async function TeachingPreferencesPage() {
  const user = await requireUser();
  const [subjects, mine] = await Promise.all([
    db.subject.findMany({ orderBy: [{ kind: "asc" }, { code: "asc" }], include: { _count: { select: { preferences: true, plans: true } } } }),
    db.teachingPreference.findMany({ where: { userId: user.id }, select: { subjectId: true } }),
  ]);
  const chosen = new Set(mine.map((m) => m.subjectId));
  const groups = (["MD", "MH"] as const).map((k) => ({ kind: k, items: subjects.filter((s) => s.kind === k) }));

  return (
    <>
      <PageHeader
        title="Đăng ký môn có thể dạy"
        description="Tích chọn các học phần bạn có thể giảng dạy. Khi xếp thời khóa biểu, hệ thống ưu tiên giao môn cho người đã đăng ký, đồng thời chia đều số buổi giữa các giảng viên."
      />
      {subjects.length === 0 ? (
        <Card>
          <EmptyState icon={BookCheck} title="Chưa có học phần nào">
            Quản lý khoa cần nhập danh mục học phần trước.
          </EmptyState>
        </Card>
      ) : (
        <ActionForm action={saveTeachingPreferences} resetOnSuccess={false} className="max-w-5xl">
          <p className="text-sm text-ink-muted">
            Bạn đã chọn <span className="font-semibold text-ink">{chosen.size}</span> môn. Có thể thay đổi bất kỳ lúc nào; lần xếp lịch tiếp theo sẽ dùng đăng ký mới.
          </p>
          {groups.map(
            (g) =>
              g.items.length > 0 && (
                <Card key={g.kind} title={`${SUBJECT_KIND[g.kind].label} (${SUBJECT_KIND[g.kind].short} · ${SUBJECT_KIND[g.kind].hours} giờ/buổi)`}>
                  <fieldset>
                    <legend className="sr-only">{SUBJECT_KIND[g.kind].label}</legend>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {g.items.map((s) => (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:border-action has-[:checked]:border-action has-[:checked]:bg-blue-50/60"
                        >
                          <input type="checkbox" name="subjectId" value={s.id} defaultChecked={chosen.has(s.id)} className="mt-1 size-4 accent-blue-600" />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-ink">{s.name}</span>
                            <span className="block text-xs text-ink-muted">
                              {s.code} · {s.hours} giờ · {s._count.preferences} người đã đăng ký · {s._count.plans} lớp cần học
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </Card>
              ),
          )}
          <div className="sticky bottom-4 z-10">
            <SubmitButton className="btn btn-primary shadow-lg">Lưu đăng ký</SubmitButton>
          </div>
        </ActionForm>
      )}
    </>
  );
}

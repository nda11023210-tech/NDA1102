"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { PENDING_EVIDENCE } from "@/lib/permissions";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { deleteUpload, saveUploads } from "@/lib/uploads";
import { fromLocalInput, str } from "@/lib/utils";

const refresh = () => revalidatePath("/minh-chung", "layout");

/** Tiêu chí nhập mỗi dòng: "TC1.1 | Tên tiêu chí" (hoặc chỉ tên – hệ thống tự đánh mã) */
function parseCriteria(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [a, ...rest] = line.split("|").map((s) => s.trim());
      return rest.length ? { code: a, title: rest.join(" | "), order: i } : { code: `TC${i + 1}`, title: a, order: i };
    });
}

export async function createCampaign(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await attempt(async () => {
    const user = await requireRole("MANAGER");
    const title = str(fd, "title");
    const agency = str(fd, "agency");
    const openAt = fromLocalInput(str(fd, "openAt"));
    const closeAt = fromLocalInput(str(fd, "closeAt"));
    const criteria = parseCriteria(str(fd, "criteria"));
    if (!title || !agency || !openAt || !closeAt) return fail("Vui lòng nhập đủ tên đợt, cơ quan và thời hạn.");
    if (closeAt <= openAt) return fail("Hạn nộp phải sau ngày mở.");
    if (!criteria.length) return fail("Cần ít nhất một tiêu chí.");
    const c = await db.evidenceCampaign.create({
      data: { title, agency, openAt, closeAt, description: str(fd, "description") || null, createdById: user.id, criteria: { create: criteria } },
    });
    id = c.id;
    return ok("Đã tạo đợt minh chứng.");
  });
  if (res?.ok) {
    refresh();
    redirect(`/minh-chung/${id}`);
  }
  return res;
}

export async function submitEvidence(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireUser();
    const campaignId = str(fd, "campaignId");
    const criterionId = str(fd, "criterionId");
    const title = str(fd, "title");
    if (!criterionId || !title) return fail("Vui lòng chọn tiêu chí và nhập tên minh chứng.");
    const campaign = await db.evidenceCampaign.findUniqueOrThrow({ where: { id: campaignId } });
    if (campaign.closeAt < new Date()) return fail("Đợt minh chứng đã hết hạn nộp.");
    const hasFile = fd.getAll("files").some((f) => f instanceof File && f.size > 0);
    if (!hasFile) return fail("Vui lòng đính kèm ít nhất một tệp minh chứng.");
    const ev = await db.evidence.create({
      data: {
        campaignId,
        criterionId,
        title,
        description: str(fd, "description") || null,
        submitterId: user.id,
        logs: { create: { actorId: user.id, action: "SUBMIT" } },
      },
    });
    await saveUploads(fd, user.id, { evidenceId: ev.id });
    refresh();
    return ok("Đã nộp minh chứng. Hồ sơ đã được chuyển tới Quản lý khoa để duyệt.");
  });
}

/**
 * Duyệt minh chứng (1 cấp): SUBMITTED --(Quản lý khoa)--> APPROVED hoặc REJECTED.
 * Mỗi quyết định ghi một dòng EvidenceLog gồm người duyệt, thời điểm, ý kiến.
 * Lịch sử chỉ được THÊM, không có thao tác sửa/xóa log ở bất kỳ đâu trong hệ thống;
 * hồ sơ đã phê duyệt cũng không thể nộp lại hay chỉnh sửa.
 */
export async function reviewEvidence(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireRole("MANAGER");
    const id = str(fd, "id");
    const decision = str(fd, "decision");
    const comment = str(fd, "comment") || null;
    if (decision === "reject" && !comment) return fail("Vui lòng ghi rõ nội dung cần bổ sung khi trả hồ sơ.");
    if (decision !== "approve" && decision !== "reject") return fail("Thao tác không hợp lệ.");

    // Cập nhật có điều kiện trạng thái: tránh hai người cùng duyệt một hồ sơ
    const status = decision === "approve" ? "APPROVED" : "REJECTED";
    const done = await db.$transaction(async (tx) => {
      const updated = await tx.evidence.updateMany({ where: { id, status: { in: PENDING_EVIDENCE } }, data: { status } });
      if (updated.count === 0) return false;
      await tx.evidenceLog.create({ data: { evidenceId: id, actorId: user.id, action: decision === "approve" ? "APPROVE" : "REJECT", comment } });
      return true;
    });
    if (!done) return fail("Hồ sơ đã được người khác xử lý hoặc không còn ở trạng thái chờ duyệt.");
    refresh();
    return ok(decision === "approve" ? `Đã phê duyệt minh chứng (người duyệt: ${user.name}).` : "Đã trả hồ sơ, yêu cầu giảng viên bổ sung.");
  });
}

export async function resubmitEvidence(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireUser();
    const id = str(fd, "id");
    const ev = await db.evidence.findUniqueOrThrow({ where: { id } });
    if (ev.submitterId !== user.id) return fail("Chỉ người nộp mới được bổ sung hồ sơ.");
    if (ev.status !== "REJECTED") return fail("Hồ sơ không ở trạng thái cần bổ sung.");
    await saveUploads(fd, user.id, { evidenceId: id });
    await db.evidence.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        description: str(fd, "description") || ev.description,
        logs: { create: { actorId: user.id, action: "RESUBMIT", comment: str(fd, "comment") || null } },
      },
    });
    refresh();
    return ok("Đã nộp lại hồ sơ.");
  });
}

// ───────── Sửa / xóa đợt minh chứng và tiêu chí ─────────

export async function updateCampaign(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("ADMIN");
    const id = str(fd, "id");
    const title = str(fd, "title");
    const agency = str(fd, "agency");
    const openAt = fromLocalInput(str(fd, "openAt"));
    const closeAt = fromLocalInput(str(fd, "closeAt"));
    if (!title || !agency || !openAt || !closeAt) return fail("Vui lòng nhập đủ tên đợt, cơ quan và thời hạn.");
    if (closeAt <= openAt) return fail("Hạn nộp phải sau ngày mở.");
    await db.evidenceCampaign.update({ where: { id }, data: { title, agency, openAt, closeAt, description: str(fd, "description") || null } });
    refresh();
    return ok("Đã cập nhật thông tin đợt minh chứng.");
  });
}

/** Thêm mới (không có id) hoặc sửa một tiêu chí */
export async function saveCriterion(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("ADMIN");
    const id = str(fd, "id");
    const campaignId = str(fd, "campaignId");
    const code = str(fd, "code");
    const title = str(fd, "title");
    if (!code || !title) return fail("Vui lòng nhập mã và tên tiêu chí.");
    if (id) {
      await db.evidenceCriterion.update({ where: { id }, data: { code, title } });
    } else {
      const last = await db.evidenceCriterion.aggregate({ where: { campaignId }, _max: { order: true } });
      await db.evidenceCriterion.create({ data: { campaignId, code, title, order: (last._max.order ?? -1) + 1 } });
    }
    refresh();
    return ok(id ? "Đã lưu tiêu chí." : `Đã thêm tiêu chí ${code}.`);
  });
}

export async function deleteCriterion(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("ADMIN");
    const id = str(fd, "id");
    const n = await db.evidence.count({ where: { criterionId: id } });
    if (n) return fail(`Tiêu chí đã có ${n} minh chứng – không thể xóa. Có thể đổi tên tiêu chí thay vì xóa.`);
    await db.evidenceCriterion.delete({ where: { id } });
    refresh();
    return ok("Đã xóa tiêu chí.");
  });
}

/** Xóa cả đợt: tiêu chí, minh chứng, lịch sử duyệt và tệp đính kèm (kể cả tệp trên ổ đĩa) */
export async function deleteCampaign(_: ActionState, fd: FormData): Promise<ActionState> {
  let deleted = false;
  const res = await attempt(async () => {
    await requireRole("ADMIN");
    const id = str(fd, "id");
    const files = await db.attachment.findMany({ where: { evidence: { campaignId: id } }, select: { storedName: true } });
    const c = await db.evidenceCampaign.delete({ where: { id } });
    await Promise.all(files.map((f) => deleteUpload(f.storedName)));
    refresh();
    deleted = true;
    return ok(`Đã xóa đợt “${c.title}”.`);
  });
  if (res?.ok && deleted) redirect("/minh-chung");
  return res;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { attempt, fail, ok, type ActionState } from "@/lib/action-state";
import { ASSET_CATEGORY, ASSET_STATUS, INVENTORY_CONDITION } from "@/lib/constants";
import { fromLocalInput, str } from "@/lib/utils";

const refresh = (code?: string) => {
  revalidatePath("/tai-san", "layout");
  if (code) revalidatePath(`/tai-san/${code}`);
};

export async function createAsset(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    await requireRole("MANAGER");
    const code = str(fd, "code").toUpperCase();
    const name = str(fd, "name");
    const category = str(fd, "category");
    if (!code || !name || !ASSET_CATEGORY[category]) return fail("Vui lòng nhập mã, tên và chọn loại thiết bị.");
    if (!/^[A-Z0-9-]{3,30}$/.test(code)) return fail("Mã thiết bị chỉ gồm chữ in hoa, số và dấu gạch ngang (3–30 ký tự).");
    if (await db.asset.findUnique({ where: { code } })) return fail("Mã thiết bị đã tồn tại.");
    const value = Number(str(fd, "value").replace(/\D/g, ""));
    await db.asset.create({
      data: {
        code,
        name,
        category,
        location: str(fd, "location") || "Kho Khoa",
        serial: str(fd, "serial") || null,
        purchaseDate: fromLocalInput(str(fd, "purchaseDate")),
        value: value || null,
        note: str(fd, "note") || null,
      },
    });
    refresh();
    return ok(`Đã thêm thiết bị ${code}.`);
  });
}

/** Sửa toàn bộ thông tin thiết bị (đổi mã thì tem QR cũ hết hiệu lực – cần in lại tem) */
export async function updateAsset(_: ActionState, fd: FormData): Promise<ActionState> {
  let newCode = "";
  const res = await attempt(async () => {
    await requireRole("ADMIN");
    const id = str(fd, "id");
    const code = str(fd, "code").toUpperCase();
    const name = str(fd, "name");
    const category = str(fd, "category");
    const status = str(fd, "status");
    if (!code || !name || !ASSET_CATEGORY[category]) return fail("Vui lòng nhập mã, tên và chọn loại thiết bị.");
    if (!/^[A-Z0-9-]{3,30}$/.test(code)) return fail("Mã thiết bị chỉ gồm chữ in hoa, số và dấu gạch ngang (3–30 ký tự).");
    if (!ASSET_STATUS[status]) return fail("Trạng thái không hợp lệ.");
    const old = await db.asset.findUniqueOrThrow({ where: { id } });
    if (code !== old.code && (await db.asset.findUnique({ where: { code } }))) return fail("Mã thiết bị đã tồn tại.");
    const value = Number(str(fd, "value").replace(/\D/g, ""));
    await db.asset.update({
      where: { id },
      data: {
        code,
        name,
        category,
        status,
        location: str(fd, "location") || "Kho Khoa",
        serial: str(fd, "serial") || null,
        purchaseDate: fromLocalInput(str(fd, "purchaseDate")),
        value: value || null,
        note: str(fd, "note") || null,
      },
    });
    refresh(old.code);
    newCode = code !== old.code ? code : "";
    return ok(code !== old.code ? "Đã cập nhật thiết bị. Mã đã đổi – nhớ in lại tem QR." : "Đã cập nhật thiết bị.");
  });
  if (res?.ok && newCode) redirect(`/tai-san/${newCode}`);
  return res;
}

/** Xóa thiết bị (kèm lịch sử mượn/trả và kiểm kê). Không cho xóa khi đang có người mượn hoặc chờ duyệt mượn. */
export async function deleteAsset(_: ActionState, fd: FormData): Promise<ActionState> {
  let deleted = false;
  const res = await attempt(async () => {
    await requireRole("ADMIN");
    const id = str(fd, "id");
    const active = await db.assetLoan.count({ where: { assetId: id, status: { in: ["PENDING", "APPROVED"] } } });
    if (active) return fail("Thiết bị đang có yêu cầu mượn chờ duyệt hoặc đang được mượn. Hãy xử lý xong việc mượn/trả trước khi xóa.");
    const a = await db.asset.delete({ where: { id } });
    refresh();
    deleted = str(fd, "from") === "detail";
    return ok(`Đã xóa thiết bị ${a.code}.`);
  });
  if (res?.ok && deleted) redirect("/tai-san");
  return res;
}

export async function requestLoan(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireUser();
    const assetId = str(fd, "assetId");
    const startAt = fromLocalInput(str(fd, "startAt"));
    const dueAt = fromLocalInput(str(fd, "dueAt"));
    const purpose = str(fd, "purpose");
    if (!startAt || !dueAt || !purpose) return fail("Vui lòng nhập mục đích và thời gian mượn.");
    if (dueAt <= startAt) return fail("Thời gian trả phải sau thời gian mượn.");
    const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
    if (asset.status !== "AVAILABLE") return fail("Thiết bị hiện không sẵn sàng để mượn.");
    const overlap = await db.assetLoan.findFirst({
      where: { assetId, status: { in: ["PENDING", "APPROVED"] }, startAt: { lt: dueAt }, dueAt: { gt: startAt } },
    });
    if (overlap) return fail("Đã có yêu cầu mượn trùng khoảng thời gian này.");
    await db.assetLoan.create({ data: { assetId, borrowerId: user.id, purpose, startAt, dueAt } });
    refresh(asset.code);
    return ok("Đã gửi yêu cầu mượn. Quản lý khoa sẽ duyệt sớm.");
  });
}

export async function decideLoan(fd: FormData) {
  const user = await requireRole("MANAGER");
  const id = str(fd, "id");
  const decision = str(fd, "decision");
  const loan = await db.assetLoan.findUniqueOrThrow({ where: { id }, include: { asset: true } });
  if (decision === "approve" && loan.status === "PENDING") {
    await db.$transaction([
      db.assetLoan.update({ where: { id }, data: { status: "APPROVED", approvedById: user.id } }),
      db.asset.update({ where: { id: loan.assetId }, data: { status: "BORROWED" } }),
    ]);
  } else if (decision === "reject" && loan.status === "PENDING") {
    await db.assetLoan.update({ where: { id }, data: { status: "REJECTED", approvedById: user.id } });
  } else if (decision === "return" && loan.status === "APPROVED") {
    const damaged = str(fd, "condition") === "DAMAGED";
    await db.$transaction([
      db.assetLoan.update({
        where: { id },
        data: { status: "RETURNED", returnedAt: new Date(), returnNote: str(fd, "returnNote") || (damaged ? "Trả về có hư hỏng" : null) },
      }),
      db.asset.update({ where: { id: loan.assetId }, data: { status: damaged ? "MAINTENANCE" : "AVAILABLE" } }),
    ]);
  }
  refresh(loan.asset.code);
}

export async function createInventoryCheck(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireRole("MANAGER");
    const name = str(fd, "name");
    if (!name) return fail("Vui lòng nhập tên đợt kiểm kê.");
    if (await db.inventoryCheck.findFirst({ where: { closedAt: null } })) return fail("Đang có một đợt kiểm kê chưa kết thúc.");
    await db.inventoryCheck.create({ data: { name, createdById: user.id } });
    refresh();
    return ok("Đã mở đợt kiểm kê. Quét mã QR trên từng thiết bị để ghi nhận.");
  });
}

export async function recordInventory(_: ActionState, fd: FormData): Promise<ActionState> {
  return attempt(async () => {
    const user = await requireRole("MANAGER");
    const checkId = str(fd, "checkId");
    const assetId = str(fd, "assetId");
    const condition = str(fd, "condition");
    if (!INVENTORY_CONDITION[condition]) return fail("Vui lòng chọn tình trạng.");
    const check = await db.inventoryCheck.findUniqueOrThrow({ where: { id: checkId } });
    if (check.closedAt) return fail("Đợt kiểm kê đã kết thúc.");
    const note = str(fd, "note") || null;
    await db.inventoryItem.upsert({
      where: { checkId_assetId: { checkId, assetId } },
      create: { checkId, assetId, condition, note, checkedById: user.id },
      update: { condition, note, checkedById: user.id, checkedAt: new Date() },
    });
    const a = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
    if (condition === "DAMAGED" && a.status === "AVAILABLE") await db.asset.update({ where: { id: assetId }, data: { status: "BROKEN" } });
    refresh(a.code);
    revalidatePath(`/tai-san/kiem-ke/${checkId}`);
    return ok(`Đã ghi nhận kiểm kê ${a.code}: ${INVENTORY_CONDITION[condition].label}.`);
  });
}

export async function closeInventoryCheck(fd: FormData) {
  await requireRole("MANAGER");
  const id = str(fd, "id");
  await db.inventoryCheck.update({ where: { id }, data: { closedAt: new Date() } });
  refresh();
  revalidatePath(`/tai-san/kiem-ke/${id}`);
}

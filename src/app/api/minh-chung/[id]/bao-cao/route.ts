import { NextResponse } from "next/server";
import { getCurrentUser, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { EVIDENCE_ACTION, EVIDENCE_STATUS } from "@/lib/constants";
import { fmtDateTime, normalizeVi } from "@/lib/utils";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// Xuất báo cáo minh chứng dạng CSV (UTF-8 BOM – mở trực tiếp bằng Excel)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isManager(user)) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const { id } = await params;

  const campaign = await db.evidenceCampaign.findUnique({
    where: { id },
    include: {
      criteria: {
        orderBy: { order: "asc" },
        include: {
          evidences: {
            include: { submitter: true, attachments: true, logs: { include: { actor: true }, orderBy: { createdAt: "asc" } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const origin = new URL(req.url).origin;
  const rows: string[][] = [
    [`BÁO CÁO MINH CHỨNG: ${campaign.title}`],
    [`Cơ quan yêu cầu: ${campaign.agency}`],
    [`Xuất lúc: ${fmtDateTime(new Date())} bởi ${user.name}`],
    [],
    ["Mã TC", "Tiêu chí", "Tên minh chứng", "Người nộp", "Trạng thái", "Ngày nộp", "Lịch sử duyệt", "Tệp đính kèm"],
  ];
  for (const c of campaign.criteria) {
    if (!c.evidences.length) {
      rows.push([c.code, c.title, "(Chưa có minh chứng)", "", "", "", "", ""]);
      continue;
    }
    for (const e of c.evidences) {
      rows.push([
        c.code,
        c.title,
        e.title,
        e.submitter.name,
        EVIDENCE_STATUS[e.status]?.label ?? e.status,
        fmtDateTime(e.createdAt),
        e.logs.map((l) => `${fmtDateTime(l.createdAt)} – ${EVIDENCE_ACTION[l.action]} (${l.actor.name})${l.comment ? `: ${l.comment}` : ""}`).join("\n"),
        e.attachments.map((a) => `${a.fileName}: ${origin}/api/files/${a.id}`).join("\n"),
      ]);
    }
  }
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const fname = `bao-cao-minh-chung-${normalizeVi(campaign.title).replace(/[^a-z0-9]+/g, "-").slice(0, 50)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}

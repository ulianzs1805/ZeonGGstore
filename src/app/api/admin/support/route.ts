import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";

export async function GET() {
  const access = await requirePermission("SUPPORT_MANAGE");
  if (!access.user) return access.response;
  const tickets = await prisma.supportTicket.findMany({ include: { user: { select: { email: true, name: true } }, messages: { orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" }, take: 200 });
  return NextResponse.json({ tickets });
}

export async function PATCH(request: Request) {
  const access = await requirePermission("SUPPORT_MANAGE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null);
  const ticketId = typeof body?.ticketId === "string" ? body.ticketId : "";
  const status = typeof body?.status === "string" && ["OPEN", "IN_PROGRESS", "CLOSED"].includes(body.status) ? body.status : "";
  if (!ticketId || !status) return NextResponse.json({ error: "Укажите ticketId и корректный статус." }, { status: 400 });
  const ticket = await prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
  await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "SUPPORT_UPDATED", targetType: "SUPPORT_TICKET", targetId: ticketId, metadata: { status } });
  return NextResponse.json({ ticket });
}
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";

async function getTicket(ticketId: string) {
  return prisma.supportTicket.findUnique({ where: { id: ticketId }, include: { messages: { include: { author: { select: { name: true, email: true, role: true } } }, orderBy: { createdAt: "asc" } } } });
}

export async function GET(_request: Request, context: { params: Promise<{ ticketId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const { ticketId } = await context.params;
  const ticket = await getTicket(ticketId);
  if (!ticket) return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 });
  const staff = user.role === "ADMIN" || user.role === "DEV" || user.role === "NPN1_DEV";
  if (ticket.userId !== user.id && !staff) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  return NextResponse.json({ ticket });
}

export async function POST(request: Request, context: { params: Promise<{ ticketId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const { ticketId } = await context.params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 });
  const staff = user.role === "ADMIN" || user.role === "DEV" || user.role === "NPN1_DEV";
  if (ticket.userId !== user.id && !staff) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  if (staff) {
    const access = await requirePermission("SUPPORT_MANAGE");
    if (!access.user) return access.response;
  }
  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (text.length < 1 || text.length > 4000) return NextResponse.json({ error: "Сообщение должно содержать от 1 до 4000 символов." }, { status: 400 });
  const message = await prisma.supportMessage.create({ data: { ticketId, authorUserId: user.id, body: text } });
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: staff ? "IN_PROGRESS" : "OPEN" } });
  if (staff) await writeAuditLog({ actorUserId: user.id, actorRole: user.role, action: "SUPPORT_UPDATED", targetType: "SUPPORT_TICKET", targetId: ticketId, metadata: { messageId: message.id } });
  return NextResponse.json({ message }, { status: 201 });
}
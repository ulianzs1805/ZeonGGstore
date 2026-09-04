import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";

const parseLabel = (label: string | null) => { try { return label ? JSON.parse(label) as Record<string, unknown> : {}; } catch { return {}; } };
const allowed = ["PENDING", "PROCESSING", "SUCCESS", "CANCELED"] as const;
type Status = typeof allowed[number];

export async function GET() {
  const access = await requirePermission("WITHDRAWAL_MANAGE");
  if (!access.user) return access.response;
  const operations = await prisma.operation.findMany({
    where: { type: "WITHDRAWAL" }, include: { user: { select: { id: true, name: true, email: true } }, item: true },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return NextResponse.json({ withdrawals: operations.map((operation) => ({ id: operation.id, status: operation.status, createdAt: operation.createdAt, user: operation.user, item: operation.item, details: parseLabel(operation.label) })) });
}

export async function PATCH(request: Request) {
  const access = await requirePermission("WITHDRAWAL_MANAGE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown; note?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = typeof body?.status === "string" ? body.status.toUpperCase() as Status : null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (!id || !status || !allowed.includes(status)) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const operation = await tx.operation.findUnique({ where: { id }, include: { item: true } });
      if (!operation || operation.type !== "WITHDRAWAL") throw new Error("NOT_FOUND");
      if (operation.status === "SUCCESS" || operation.status === "CANCELED") throw new Error("FINAL");
      if (status === "SUCCESS" && !operation.item) throw new Error("NO_ITEM");
      const now = new Date();
      if (status === "SUCCESS") {
        const claimed = await tx.inventoryItem.updateMany({ where: { id: operation.itemId ?? "", userId: operation.userId, soldAt: null }, data: { soldAt: now } });
        if (claimed.count !== 1) throw new Error("ITEM_NOT_AVAILABLE");
      }
      const details = parseLabel(operation.label);
      details.adminNote = note || undefined;
      details.completedBy = access.user!.id;
      const updated = await tx.operation.update({ where: { id }, data: { status, label: JSON.stringify(details) }, include: { item: true } });
      await tx.notification.create({ data: { userId: operation.userId, type: "WITHDRAWAL", title: status === "SUCCESS" ? "Вывод выполнен" : status === "CANCELED" ? "Вывод отменён" : "Заявка на вывод обновлена", body: status === "SUCCESS" ? `Вывод «${operation.item?.name ?? "предмет"}» выполнен.` : status === "CANCELED" ? `Заявка на вывод отменена${note ? `: ${note}` : "."}` : `Статус заявки: ${status}.`, } });
      return updated;
    });
    await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "WITHDRAWAL_STATUS_UPDATED", targetType: "OPERATION", targetId: id, metadata: { status, note }, status: "SUCCESS" });
    return NextResponse.json({ id: result.id, status: result.status });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    if (code === "FINAL") return NextResponse.json({ error: "Заявка уже завершена" }, { status: 409 });
    if (code === "NO_ITEM" || code === "ITEM_NOT_AVAILABLE") return NextResponse.json({ error: "Предмет уже недоступен" }, { status: 409 });
    return NextResponse.json({ error: "Не удалось обновить заявку" }, { status: 500 });
  }
}

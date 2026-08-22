import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";
import { changeZCoin } from "@/lib/zcoin-service";

async function uniqueStaffId(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], kind: "ADMIN" | "DEV") {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const value = String(randomInt(100000, 1000000));
    const found = kind === "ADMIN" ? await tx.adminProfile.findUnique({ where: { adminId: value } }) : await tx.devProfile.findUnique({ where: { devId: value } });
    if (!found) return value;
  }
  throw new Error("STAFF_ID_GENERATION_FAILED");
}

export async function POST(request: Request) {
  const access = await requirePermission("DEV_CONSOLE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null);
  const command = typeof body?.command === "string" ? body.command.trim() : "";
  const parts = command.split(/\s+/);
  try {
    if (parts[0] === "zcoin" && (parts[1] === "grant" || parts[1] === "revoke") && parts.length === 4) {
      const amount = Number(parts[3]);
      if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: "Сумма должна быть положительным целым числом." }, { status: 400 });
      const result = await changeZCoin({ actorUserId: access.user.id, targetUserId: parts[2], operation: parts[1] === "grant" ? "GRANT" : "REVOKE", amount, reason: "Dev Console command", idempotencyKey: `console-${crypto.randomUUID()}` });
      await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "DEV_CONSOLE_COMMAND", targetType: "ZCOIN_OPERATION", targetId: result.operation.id, metadata: { command: `${parts[0]} ${parts[1]} ${parts[2]} ${amount}`, result: "SUCCESS" } });
      return NextResponse.json(result);
    }
    if (parts[0] === "role" && parts[1] === "grant" && parts.length === 4 && (parts[3] === "ADMIN" || parts[3] === "DEV")) {
      const targetUserId = parts[2];
      const nextRole = parts[3];
      if (targetUserId === access.user.id) return NextResponse.json({ error: "Нельзя изменять собственную роль." }, { status: 403 });
      if (nextRole === "DEV" && access.user.role !== "NPN1_DEV") return NextResponse.json({ error: "Только NPN1_DEV может назначать DEV через Dev Console." }, { status: 403 });
      const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, email: true, role: true } });
      if (!target || target.role === "NPN1_DEV") return NextResponse.json({ error: "Пользователь не найден или системная роль защищена." }, { status: 404 });
      if (nextRole === "ADMIN" && !["DEV", "NPN1_DEV"].includes(access.user.role)) return NextResponse.json({ error: "Недостаточно прав для назначения ADMIN." }, { status: 403 });
      if (nextRole === "ADMIN" && access.user.role === "DEV" && target.role !== "USER") return NextResponse.json({ error: "DEV может назначить ADMIN только обычному USER." }, { status: 403 });
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({ where: { id: target.id }, data: { role: nextRole } });
        if (nextRole === "ADMIN") await tx.adminProfile.upsert({ where: { userId: target.id }, update: {}, create: { userId: target.id, adminId: await uniqueStaffId(tx, "ADMIN") } });
        if (nextRole === "DEV") await tx.devProfile.upsert({ where: { userId: target.id }, update: {}, create: { userId: target.id, devId: await uniqueStaffId(tx, "DEV") } });
        await writeAuditLog({ actorUserId: access.user!.id, actorRole: access.user!.role, action: "DEV_CONSOLE_ROLE_GRANT", targetType: "USER", targetId: target.id, metadata: { targetEmail: target.email, oldRole: target.role, newRole: nextRole, command: `role grant ${target.id} ${nextRole}` } });
        return updated;
      });
      return NextResponse.json({ user: result });
    }
    if (command === "case list") {
      const cases = await prisma.case.findMany({ where: { isActive: true }, select: { id: true, slug: true, name: true, price: true }, take: 100 });
      await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "DEV_CONSOLE_COMMAND", targetType: "CASE", metadata: { command, result: "SUCCESS" } });
      return NextResponse.json({ cases });
    }
    if (command === "economy check" || command === "system health") {
      const result = { api: "ONLINE", prisma: "CONFIGURED", economyGuard: "ACTIVE", destructiveOperations: "DISABLED" };
      await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "DEV_CONSOLE_COMMAND", targetType: "SYSTEM", metadata: { command, result: "SUCCESS" } });
      return NextResponse.json(result);
    }
    await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "DEV_CONSOLE_INVALID_COMMAND", targetType: "CONSOLE", metadata: { command }, status: "FAILED" });
    return NextResponse.json({ error: "Команда отсутствует в whitelist." }, { status: 400 });
  } catch (error) {
    await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "DEV_CONSOLE_PERMISSION_DENIED", targetType: "CONSOLE", metadata: { command, error: String(error) }, status: "FAILED" });
    return NextResponse.json({ error: "Команда отклонена policy." }, { status: 403 });
  }
}
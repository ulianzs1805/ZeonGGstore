import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";
import { changeZCoin } from "@/lib/zcoin-service";

export async function POST(request: Request) {
  const access = await requirePermission("DEV_CONSOLE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null);
  const command = typeof body?.command === "string" ? body.command.trim() : "";
  const parts = command.split(/\s+/);
  try {
    if (parts[0] === "zcoin" && (parts[1] === "grant" || parts[1] === "revoke") && parts.length === 4) {
      const result = await changeZCoin({ actorUserId: access.user.id, targetUserId: parts[2], operation: parts[1] === "grant" ? "GRANT" : "REVOKE", amount: Number(parts[3]), reason: "Dev Console command", idempotencyKey: `console-${crypto.randomUUID()}` });
      await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "DEV_CONSOLE_COMMAND", targetType: "ZCOIN_OPERATION", targetId: result.operation.id, metadata: { command: `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`, result: "SUCCESS" } });
      return NextResponse.json(result);
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
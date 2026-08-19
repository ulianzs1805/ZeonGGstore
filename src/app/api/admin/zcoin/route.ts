import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";
import { changeZCoin, getZCoinOverview, listZCoinHistory } from "@/lib/zcoin-service";

function errorStatus(message: string) {
  return ["INSUFFICIENT_BALANCE", "INVALID_AMOUNT", "INVALID_REASON", "INVALID_IDEMPOTENCY_KEY", "BALANCE_PROTECTION"].includes(message) ? 400 : 403;
}

export async function GET(request: Request) {
  const access = await requirePermission("ZCOIN_MANAGE");
  if (!access.user) return access.response;
  const query = new URL(request.url).searchParams;
  const mode = query.get("mode") ?? "overview";
  if (mode === "users") {
    const search = (query.get("search") ?? "").trim();
    if (search.length < 2) return NextResponse.json({ users: [] });
    const users = await prisma.user.findMany({ where: { OR: [{ email: { contains: search } }, { name: { contains: search } }, { id: { contains: search } }] }, select: { id: true, email: true, name: true, avatar: true, balance: true, role: true }, take: 20 });
    return NextResponse.json({ users });
  }
  if (mode === "history") return NextResponse.json({ history: await listZCoinHistory(access.user.id) });
  return NextResponse.json(await getZCoinOverview(access.user.id));
}

export async function POST(request: Request) {
  const access = await requirePermission("ZCOIN_MANAGE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  const operation = body?.operation === "GRANT" || body?.operation === "REVOKE" ? body.operation : "";
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!targetUserId || !operation) return NextResponse.json({ error: "Укажите пользователя и операцию." }, { status: 400 });
  try {
    return NextResponse.json(await changeZCoin({ actorUserId: access.user.id, targetUserId, operation, amount, reason, idempotencyKey }), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ZCOIN_OPERATION_FAILED";
    const action = operation === "GRANT" ? "ZCOIN_GRANT_DENIED" : "ZCOIN_REVOKE_DENIED";
    await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action, targetType: "USER", targetId: targetUserId, metadata: { amount, reason, idempotencyKey, denialReason: code }, status: "FAILED" }).catch(() => null);
    return NextResponse.json({ error: code === "OPERATION_LIMIT_EXCEEDED" ? "Превышен максимальный размер операции для ZEON DEV." : code === "DAILY_LIMIT_EXCEEDED" || code === "TOTAL_DAILY_LIMIT_EXCEEDED" || code === "OPERATION_COUNT_LIMIT_EXCEEDED" ? "Дневной лимит ZEON DEV исчерпан." : code === "USER_DAILY_LIMIT_EXCEEDED" ? "Достигнут дневной лимит изменения баланса этого пользователя." : code === "INSUFFICIENT_BALANCE" ? "Недостаточно Z-Coin у пользователя." : "Операция Z-Coin отклонена.", code }, { status: errorStatus(code) });
  }
}
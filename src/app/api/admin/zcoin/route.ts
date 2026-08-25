import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";
import { changeZCoin, getZCoinOverview, listZCoinHistory } from "@/lib/zcoin-service";

function errorStatus(message: string) {
  return ["INSUFFICIENT_BALANCE", "INVALID_AMOUNT", "INVALID_REASON", "INVALID_IDEMPOTENCY_KEY", "BALANCE_PROTECTION"].includes(message) ? 400 : 403;
}

const errorMessage = (code: string) => {
  const messages: Record<string, string> = {
    OPERATION_LIMIT_EXCEEDED: "Превышен максимальный размер одной операции Z-Coin.",
    DAILY_LIMIT_EXCEEDED: "Исчерпан дневной лимит этой операции Z-Coin.",
    TOTAL_DAILY_LIMIT_EXCEEDED: "Исчерпан общий дневной лимит Z-Coin.",
    OPERATION_COUNT_LIMIT_EXCEEDED: "Исчерпан дневной лимит количества операций.",
    USER_DAILY_LIMIT_EXCEEDED: "Достигнут дневной лимит изменения баланса этого пользователя.",
    INSUFFICIENT_BALANCE: "Недостаточно Z-Coin у пользователя для списания.",
    BALANCE_PROTECTION: "Новый баланс превышает допустимый максимум.",
    INVALID_AMOUNT: "Укажите корректное целое количество Z-Coin больше нуля.",
    INVALID_REASON: "Укажите причину операции длиной от 5 символов.",
    INVALID_IDEMPOTENCY_KEY: "Не удалось сформировать ключ операции. Повторите попытку.",
    IDEMPOTENCY_CONFLICT: "Эта операция уже была выполнена с другими параметрами. Повторите попытку.",
    USER_NOT_FOUND: "Пользователь не найден.",
  };
  return messages[code] ?? `Операция Z-Coin отклонена: ${code}`;
};

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
  const rawAmount = body?.amount;
  const amount = typeof rawAmount === "number" ? rawAmount : typeof rawAmount === "string" ? Number(rawAmount) : NaN;
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.trim() ? body.idempotencyKey : crypto.randomUUID();
  if (!targetUserId || !operation) return NextResponse.json({ error: "Укажите пользователя и операцию." }, { status: 400 });
  try {
    return NextResponse.json(await changeZCoin({ actorUserId: access.user.id, targetUserId, operation, amount, reason, idempotencyKey }), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ZCOIN_OPERATION_FAILED";
    const action = operation === "GRANT" ? "ZCOIN_GRANT_DENIED" : "ZCOIN_REVOKE_DENIED";
    await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action, targetType: "USER", targetId: targetUserId, metadata: { amount, reason, idempotencyKey, denialReason: code }, status: "FAILED" }).catch(() => null);
    return NextResponse.json({ error: errorMessage(code), code }, { status: errorStatus(code) });
  }
}

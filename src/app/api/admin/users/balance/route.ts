import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";

export async function POST(request: Request) {
  const access = await requirePermission("USER_BALANCE_ADJUST");
  if (!access.user) return access.response;

  const body = await request.json().catch(() => null) as { userId?: unknown; amount?: unknown; reason?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "Админ-корректировка Z-Coin";

  if (!userId) return NextResponse.json({ error: "Не указан пользователь" }, { status: 400 });
  if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000_000) {
    return NextResponse.json({ error: "Сумма должна быть целым числом от -1 000 000 000 до 1 000 000 000 и не равняться нулю" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, balance: true, email: true } });
  if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

  const nextBalance = target.balance + amount;
  if (nextBalance < 0) return NextResponse.json({ error: "Нельзя списать больше, чем есть на балансе" }, { status: 400 });

  const operationId = crypto.randomUUID();
  const operation = amount > 0 ? "ADMIN_GRANT" : "ADMIN_DEBIT";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: target.id, balance: target.balance },
        data: { balance: { increment: amount } },
      });
      if (updated.count !== 1) throw new Error("BALANCE_CHANGED_CONCURRENTLY");

      const zcoinOperation = await tx.zCoinOperation.create({
        data: {
          idempotencyKey: operationId,
          actorUserId: access.user!.id,
          targetUserId: target.id,
          operation,
          amount: Math.abs(amount),
          oldBalance: target.balance,
          newBalance: nextBalance,
          reason: reason || "Админ-корректировка Z-Coin",
          status: "SUCCESS",
        },
      });

      return { balance: nextBalance, operationId: zcoinOperation.id };
    });

    await writeAuditLog({
      actorUserId: access.user.id,
      actorRole: access.user.role,
      action: operation,
      targetType: "USER",
      targetId: target.id,
      metadata: { amount, oldBalance: target.balance, newBalance: nextBalance, reason, operationId: result.operationId, targetEmail: target.email },
      status: "SUCCESS",
    });

    return NextResponse.json({ ok: true, userId: target.id, balance: result.balance, amount });
  } catch (error) {
    const message = error instanceof Error && error.message === "BALANCE_CHANGED_CONCURRENTLY"
      ? "Баланс изменился параллельно. Обновите список пользователей и повторите операцию."
      : "Не удалось изменить баланс";
    await writeAuditLog({
      actorUserId: access.user.id,
      actorRole: access.user.role,
      action: operation,
      targetType: "USER",
      targetId: target.id,
      metadata: { amount, reason, error: message },
      status: "FAILED",
    }).catch(() => null);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

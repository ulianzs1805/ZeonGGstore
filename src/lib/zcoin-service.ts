import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ZCoinPolicy, startOfDay } from "@/lib/zcoin-policy";

type Operation = "GRANT" | "REVOKE";

function denied(message: string): never { throw new Error(message); }

export async function getZCoinOverview(actorUserId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorUserId }, include: { devProfile: true } });
  if (!actor) throw new Error("ACTOR_NOT_FOUND");
  const since = startOfDay();
  const operations = await prisma.zCoinOperation.findMany({ where: { actorUserId, status: "SUCCESS", createdAt: { gte: since } } });
  const grant = operations.filter((item) => item.operation === "GRANT");
  const revoke = operations.filter((item) => item.operation === "REVOKE");
  return {
    actor: { id: actor.id, email: actor.email, name: actor.name, role: actor.role, staffId: actor.devProfile?.devId ?? null },
    policy: ZCoinPolicy,
    used: { grant: grant.reduce((sum, item) => sum + item.amount, 0), revoke: revoke.reduce((sum, item) => sum + item.amount, 0), total: operations.reduce((sum, item) => sum + item.amount, 0), grantOperations: grant.length, revokeOperations: revoke.length },
  };
}

export async function changeZCoin(input: { actorUserId: string; targetUserId: string; operation: Operation; amount: number; reason: string; idempotencyKey: string }) {
  const { actorUserId, targetUserId, operation, amount, reason, idempotencyKey } = input;
  if (!idempotencyKey || idempotencyKey.length > 120) denied("INVALID_IDEMPOTENCY_KEY");
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > ZCoinPolicy.SYSTEM_MAX_OPERATION) denied("INVALID_AMOUNT");
  if (reason.trim().length < 5 || reason.length > 500) denied("INVALID_REASON");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.zCoinOperation.findUnique({ where: { idempotencyKey } });
    if (existing) return { replay: true, operation: existing };
    const actor = await tx.user.findUnique({ where: { id: actorUserId }, include: { devProfile: true } });
    const target = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!actor || !target) denied("USER_NOT_FOUND");
    const since = startOfDay();
    const daily = await tx.zCoinOperation.findMany({ where: { actorUserId, status: "SUCCESS", createdAt: { gte: since } } });
    const grants = daily.filter((item) => item.operation === "GRANT");
    const revokes = daily.filter((item) => item.operation === "REVOKE");
    const isOwner = actor.role === "NPN1_DEV";
    const opLimit = operation === "GRANT" ? ZCoinPolicy.DEV_GRANT_PER_OPERATION : ZCoinPolicy.DEV_REVOKE_PER_OPERATION;
    const dailyLimit = operation === "GRANT" ? ZCoinPolicy.DEV_GRANT_DAILY_LIMIT : ZCoinPolicy.DEV_REVOKE_DAILY_LIMIT;
    const userLimit = operation === "GRANT" ? ZCoinPolicy.DEV_USER_GRANT_DAILY_LIMIT : ZCoinPolicy.DEV_USER_REVOKE_DAILY_LIMIT;
    const sameUser = daily.filter((item) => item.targetUserId === targetUserId && item.operation === operation).reduce((sum, item) => sum + item.amount, 0);
    if (!isOwner && amount > opLimit) denied("OPERATION_LIMIT_EXCEEDED");
    if (!isOwner && (operation === "GRANT" ? grants.length : revokes.length) >= (operation === "GRANT" ? ZCoinPolicy.DEV_GRANT_DAILY_OPERATIONS : ZCoinPolicy.DEV_REVOKE_DAILY_OPERATIONS)) denied("OPERATION_COUNT_LIMIT_EXCEEDED");
    if (!isOwner && (operation === "GRANT" ? grants.reduce((sum, item) => sum + item.amount, 0) + amount > dailyLimit : revokes.reduce((sum, item) => sum + item.amount, 0) + amount > dailyLimit)) denied("DAILY_LIMIT_EXCEEDED");
    if (!isOwner && daily.reduce((sum, item) => sum + item.amount, 0) + amount > ZCoinPolicy.DEV_TOTAL_DAILY_LIMIT) denied("TOTAL_DAILY_LIMIT_EXCEEDED");
    if (!isOwner && sameUser + amount > userLimit) denied("USER_DAILY_LIMIT_EXCEEDED");
    if (operation === "REVOKE" && target.balance < amount) denied("INSUFFICIENT_BALANCE");
    const oldBalance = target.balance;
    const newBalance = operation === "GRANT" ? oldBalance + amount : oldBalance - amount;
    if (newBalance < 0 || newBalance > Number.MAX_SAFE_INTEGER) denied("BALANCE_PROTECTION");
    const updated = await tx.user.update({ where: { id: targetUserId }, data: { balance: newBalance } });
    const record = await tx.zCoinOperation.create({ data: { idempotencyKey, actorUserId, targetUserId, operation, amount, oldBalance, newBalance, reason: reason.trim(), status: "SUCCESS" } });
    await tx.transaction.create({ data: { userId: targetUserId, type: operation === "GRANT" ? "ZCOIN_GRANT" : "ZCOIN_REVOKE", zCoinAmount: operation === "GRANT" ? amount : -amount, status: "SUCCESS" } });
    await tx.operation.create({ data: { userId: targetUserId, type: operation === "GRANT" ? "ZCOIN_GRANT" : "ZCOIN_REVOKE", label: reason.trim(), amount: operation === "GRANT" ? amount : -amount, status: "SUCCESS" } });
    if (operation === "GRANT") {
      await tx.notification.create({ data: { userId: targetUserId, type: "ZCOIN_GRANT", title: "Вам начислены Z-Coin", body: `${amount} Z-Coin. Комментарий: ${reason.trim()}` } });
    }
    const profile = actor.role === "ADMIN" ? null : actor.devProfile?.devId ?? null;
    await tx.auditLog.create({ data: { actorUserId, actorRole: actor.role as Role, actorAdminId: profile, action: operation === "GRANT" ? "ZCOIN_GRANTED" : "ZCOIN_REVOKED", targetType: "USER", targetId: targetUserId, metadata: JSON.stringify({ targetEmail: target.email, amount, oldBalance, newBalance, reason: reason.trim(), idempotencyKey }), status: "SUCCESS" } });
    return { replay: false, operation: record, user: { id: updated.id, email: target.email, name: target.name, balance: updated.balance } };
  });
}

export async function listZCoinHistory(actorUserId: string) {
  return prisma.zCoinOperation.findMany({ where: { actorUserId }, orderBy: { createdAt: "desc" }, take: 100, include: { target: { select: { email: true, name: true } } } });
}
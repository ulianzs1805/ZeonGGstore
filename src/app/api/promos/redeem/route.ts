import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase().replace(/\s+/g, "") : "";
  if (!code) return NextResponse.json({ error: "Введи промокод." }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const promo = await tx.promoCode.findUnique({ where: { code } });
    if (!promo) return { kind: "NOT_FOUND" as const };

    if (promo.expiresAt.getTime() <= Date.now()) {
      return { kind: "EXPIRED" as const };
    }

    if (promo.ownerId && promo.ownerId !== user.id) return { kind: "NOT_FOR_USER" as const };

    const already = await tx.promoActivation.findUnique({ where: { promoId_userId: { promoId: promo.id, userId: user.id } } });
    if (already) return { kind: "USED" as const };

    const reserved = await tx.promoCode.updateMany({
      where: { id: promo.id, activationCount: { lt: promo.maxActivations } },
      data: { activationCount: { increment: 1 } },
    });
    if (reserved.count !== 1) return { kind: "EXHAUSTED" as const };

    await tx.promoActivation.create({ data: { promoId: promo.id, userId: user.id } });
    await tx.promoCode.update({ where: { id: promo.id }, data: { inventorySaved: false } });

    if (promo.type === "ZCOIN") {
      const amount = promo.zCoinAmount ?? 0;
      await tx.user.update({ where: { id: user.id }, data: { balance: { increment: amount } } });
      await tx.transaction.create({ data: { userId: user.id, type: "PROMO_ZCOIN", zCoinAmount: amount, status: "SUCCESS" } });
      return { kind: "ZCOIN" as const, amount };
    }

    if (promo.type === "DEPOSIT") {
      return { kind: "DEPOSIT" as const, percent: promo.depositPercent ?? 0 };
    }

    if (!promo.caseId) throw new Error("PROMO_CASE_MISSING");
    await tx.freeCaseGrant.create({ data: { userId: user.id, caseId: promo.caseId, sourcePromoId: promo.id } });
    return { kind: "CASE" as const, caseId: promo.caseId };
  });

  if (result.kind === "NOT_FOUND") return NextResponse.json({ error: "Промокод не найден." }, { status: 404 });
  if (result.kind === "EXPIRED") return NextResponse.json({ error: "Срок действия промокода истёк." }, { status: 410 });
  if (result.kind === "NOT_FOR_USER") return NextResponse.json({ error: "Этот промокод принадлежит другому игроку." }, { status: 403 });
  if (result.kind === "EXHAUSTED") return NextResponse.json({ error: "Лимит активаций этого промокода исчерпан." }, { status: 409 });
  if (result.kind === "USED") return NextResponse.json({ error: "Ты уже активировал этот промокод." }, { status: 409 });
  return NextResponse.json(result);
}

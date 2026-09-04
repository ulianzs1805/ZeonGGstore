import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getYooKassaPayment } from "@/lib/yookassa";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const notification = await request.json().catch(() => null) as { event?: string; object?: { id?: string } } | null;
  const paymentId = notification?.object?.id;
  if (!paymentId) return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
  try {
    const payment = await getYooKassaPayment(paymentId);
    const transaction = await prisma.transaction.findFirst({ where: { paymentId }, select: { id: true, userId: true, rubAmount: true, zCoinAmount: true, status: true } });
    if (!transaction) return NextResponse.json({ ok: true });
    const paidRub = Number(payment.amount?.value ?? 0);
    if (transaction.rubAmount !== Math.round(paidRub)) { await prisma.transaction.update({ where: { id: transaction.id }, data: { status: "CANCELED" } }).catch(() => undefined); return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 }); }
    if (payment.status === "succeeded" && payment.paid) {
      if (transaction.status === "SUCCESS") return NextResponse.json({ ok: true, alreadyProcessed: true });
      const operationKey = `deposit:${transaction.id}`;
      await prisma.$transaction(async (tx) => {
        const current = await tx.transaction.findUnique({ where: { id: transaction.id }, select: { status: true, userId: true, zCoinAmount: true, rubAmount: true } });
        if (!current || current.status === "SUCCESS") return;
        const operation = await tx.operation.findUnique({ where: { idempotencyKey: operationKey }, select: { id: true, label: true } });
        let metadata: { promoId?: string | null; bonusAmount?: number } = {};
        try { metadata = JSON.parse(operation?.label || "{}"); } catch {}
        let credit = current.zCoinAmount;
        if (metadata.promoId) {
          const promo = await tx.promoCode.findUnique({ where: { id: metadata.promoId }, select: { id: true, maxActivations: true, activationCount: true, expiresAt: true } });
          let promoApplied = false;
          if (promo && promo.expiresAt.getTime() > Date.now() && promo.activationCount < promo.maxActivations) {
            try {
              await tx.promoActivation.create({ data: { promoId: promo.id, userId: current.userId } });
              const reserved = await tx.promoCode.updateMany({ where: { id: promo.id, activationCount: { lt: promo.maxActivations } }, data: { activationCount: { increment: 1 } } });
              if (reserved.count === 1) promoApplied = true;
              else await tx.promoActivation.delete({ where: { promoId_userId: { promoId: promo.id, userId: current.userId } } }).catch(() => undefined);
            } catch {}
          }
          if (!promoApplied) credit = current.rubAmount;
        }
        await tx.user.update({ where: { id: current.userId }, data: { balance: { increment: credit } } });
        await tx.transaction.update({ where: { id: transaction.id }, data: { status: "SUCCESS", zCoinAmount: credit } });
        if (operation) await tx.operation.update({ where: { id: operation.id }, data: { status: "SUCCESS", amount: credit } });
        await tx.notification.create({ data: { userId: current.userId, type: "DEPOSIT_SUCCESS", title: "Пополнение зачислено", body: `На баланс зачислено ${credit} Z-Coin.` } });
      });
    } else if (["canceled", "expired"].includes(payment.status)) {
      await prisma.transaction.updateMany({ where: { id: transaction.id, status: { not: "SUCCESS" } }, data: { status: "CANCELED" } });
      await prisma.operation.updateMany({ where: { idempotencyKey: `deposit:${transaction.id}`, status: { not: "SUCCESS" } }, data: { status: "CANCELED" } });
    }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 }); }
}

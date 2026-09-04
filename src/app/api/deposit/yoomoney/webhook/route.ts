import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function verifySign(values: Record<string, string>, secret: string, received: string) {
  const payload = Object.entries(values)
    .filter(([key]) => key !== "sign")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.YOOMONEY_HTTP_SECRET;
  if (!secret) return NextResponse.json({ error: "YuMoney webhook is not configured" }, { status: 503 });

  const body = await request.formData();
  const values: Record<string, string> = {};
  for (const [key, value] of body.entries()) values[key] = typeof value === "string" ? value : "";

  if (!values.sign || !verifySign(values, secret, values.sign)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!values.label?.startsWith("ZG:")) return NextResponse.json({ ok: true });

  const transactionId = values.label.slice(3);
  const amountReceived = Number(values.amount);
  const withdrawn = Number(values.withdraw_amount);

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { id: true, userId: true, rubAmount: true, zCoinAmount: true, status: true },
  });

  if (!transaction) return NextResponse.json({ ok: true });
  if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (transaction.status === "SUCCESS") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  const expectedCredit = transaction.rubAmount ?? 0;

  // ЮMoney's `amount` is the amount actually credited to the wallet, while
  // `withdraw_amount` is the amount charged to the payer. Do not cancel a
  // real payment just because the two values differ due to commission/rounding.
  // A tiny tolerance also covers cent-level rounding by the payment provider.
  const receivedEnough = amountReceived + 0.02 >= expectedCredit;
  const paidEnough = Number.isFinite(withdrawn) && withdrawn + 0.02 >= expectedCredit;

  if (!receivedEnough && !paidEnough) {
    // Keep the order pending so a legitimate retry notification can still
    // complete it. Most importantly, never mark a paid order CANCELED here.
    return NextResponse.json({ ok: true, pending: true });
  }

  const operationKey = `deposit:${transaction.id}`;

  await prisma.$transaction(async (tx) => {
    const current = await tx.transaction.findUnique({
      where: { id: transaction.id },
      select: { status: true, userId: true, zCoinAmount: true },
    });

    if (!current || current.status === "SUCCESS") return;

    const operation = await tx.operation.findUnique({
      where: { idempotencyKey: operationKey },
      select: { id: true },
    });

    const credit = current.zCoinAmount ?? 0;

    await tx.user.update({
      where: { id: current.userId },
      data: { balance: { increment: credit } },
    });

    await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "SUCCESS",
        paymentId: values.operation_id || transaction.id,
        zCoinAmount: credit,
      },
    });

    if (operation) {
      await tx.operation.update({
        where: { id: operation.id },
        data: { status: "SUCCESS", amount: credit },
      });
    }

    await tx.notification.create({
      data: {
        userId: current.userId,
        type: "DEPOSIT_SUCCESS",
        title: "Пополнение зачислено",
        body: `На баланс зачислено ${credit} Z-Coin.`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

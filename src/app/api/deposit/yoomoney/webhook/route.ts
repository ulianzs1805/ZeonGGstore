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

function readPromoId(label: string | null | undefined) {
  if (!label) return null;
  try {
    const metadata = JSON.parse(label) as { promoId?: unknown };
    return typeof metadata.promoId === "string" ? metadata.promoId : null;
  } catch {
    return null;
  }
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
  const receivedEnough = amountReceived + 0.02 >= expectedCredit;
  const paidEnough = Number.isFinite(withdrawn) && withdrawn + 0.02 >= expectedCredit;

  if (!receivedEnough && !paidEnough) {
    return NextResponse.json({ ok: true, pending: true });
  }

  const operationKey = `deposit:${transaction.id}`;

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.transaction.updateMany({
        where: { id: transaction.id, status: "PENDING" },
        data: { status: "PROCESSING" },
      });

      if (claimed.count !== 1) return;

      const operation = await tx.operation.findUnique({
        where: { idempotencyKey: operationKey },
        select: { id: true, label: true, status: true },
      });

      const credit = transaction.zCoinAmount ?? 0;
      const promoId = readPromoId(operation?.label);

      await tx.user.update({
        where: { id: transaction.userId },
        data: { balance: { increment: credit } },
      });

      if (promoId) {
        const activation = await tx.promoActivation.findUnique({
          where: { promoId_userId: { promoId, userId: transaction.userId } },
          select: { id: true },
        });

        if (!activation) {
          await tx.promoActivation.create({
            data: { promoId, userId: transaction.userId },
          });
          await tx.promoCode.update({
            where: { id: promoId },
            data: { activationCount: { increment: 1 } },
          });
        }
      }

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
          userId: transaction.userId,
          type: "DEPOSIT_SUCCESS",
          title: "Пополнение зачислено",
          body: `На баланс зачислено ${credit} Z-Coin.`,
        },
      });
    });
  } catch (error) {
    // If a duplicate notification races with the first one, the unique
    // transaction state/idempotency rules make the second attempt harmless.
    console.error("YooMoney deposit processing failed", error);
    return NextResponse.json({ error: "Deposit processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

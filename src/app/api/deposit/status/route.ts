import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { getYooKassaPayment } from "@/lib/yookassa";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Необходим вход" }, 401);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "Не указан платёж." }, 400);

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    select: { id: true, rubAmount: true, zCoinAmount: true, status: true, paymentId: true, createdAt: true },
  });

  if (!transaction) return json({ error: "Платёж не найден." }, 404);

  if (transaction.paymentId && transaction.status === "PENDING") {
    try {
      const payment = await getYooKassaPayment(transaction.paymentId);
      if (payment.status === "succeeded" && payment.paid) {
        return json({
          status: "PENDING",
          amount: transaction.rubAmount,
          credit: transaction.zCoinAmount,
          paymentStatus: payment.status,
          note: "Платёж подтверждён ЮKassa, ожидается серверное зачисление.",
        });
      }
      if (["canceled", "expired"].includes(payment.status)) {
        return json({ status: "CANCELED", amount: transaction.rubAmount, credit: transaction.zCoinAmount, paymentStatus: payment.status });
      }
      return json({ status: "PENDING", amount: transaction.rubAmount, credit: transaction.zCoinAmount, paymentStatus: payment.status });
    } catch {}
  }

  return json({
    status: transaction.status,
    amount: transaction.rubAmount,
    credit: transaction.zCoinAmount,
    createdAt: transaction.createdAt.toISOString(),
  });
}

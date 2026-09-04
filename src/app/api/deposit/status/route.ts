import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { getYooKassaPayment } from "@/lib/yookassa";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан платёж." }, { status: 400 });
  const transaction = await prisma.transaction.findFirst({ where: { id, userId: user.id }, select: { id: true, rubAmount: true, zCoinAmount: true, status: true, paymentId: true, createdAt: true } });
  if (!transaction) return NextResponse.json({ error: "Платёж не найден." }, { status: 404 });
  if (transaction.paymentId && transaction.status === "PENDING") {
    try {
      const payment = await getYooKassaPayment(transaction.paymentId);
      if (payment.status === "succeeded" && payment.paid) return NextResponse.json({ status: "PENDING", amount: transaction.rubAmount, credit: transaction.zCoinAmount, paymentStatus: payment.status, note: "Платёж подтверждён ЮKassa, ожидается серверное зачисление." });
      if (["canceled", "expired"].includes(payment.status)) return NextResponse.json({ status: "CANCELED", amount: transaction.rubAmount, credit: transaction.zCoinAmount, paymentStatus: payment.status });
      return NextResponse.json({ status: "PENDING", amount: transaction.rubAmount, credit: transaction.zCoinAmount, paymentStatus: payment.status });
    } catch {}
  }
  return NextResponse.json({ status: transaction.status, amount: transaction.rubAmount, credit: transaction.zCoinAmount, createdAt: transaction.createdAt.toISOString() });
}

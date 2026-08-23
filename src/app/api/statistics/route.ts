import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const [inventory, caseOpens, sales, transactions] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { userId: user.id, soldAt: null }, select: { price: true } }),
    prisma.operation.count({ where: { userId: user.id, type: "CASE_OPEN", status: "SUCCESS" } }),
    prisma.operation.aggregate({ where: { userId: user.id, type: "ITEM_SALE", status: "SUCCESS" }, _count: true, _sum: { amount: true } }),
    prisma.transaction.findMany({ where: { userId: user.id, status: "SUCCESS" }, select: { type: true, zCoinAmount: true } }),
  ]);

  const earned = transactions
    .filter((transaction) => ["DEPOSIT", "PURCHASE", "PROMO_ZCOIN", "ZCOIN_GRANT"].includes(transaction.type))
    .reduce((total, transaction) => total + Math.max(0, transaction.zCoinAmount), 0);
  const spent = transactions
    .filter((transaction) => transaction.type === "CASE_OPEN")
    .reduce((total, transaction) => total + Math.abs(transaction.zCoinAmount), 0);

  return NextResponse.json({
    inventoryCount: inventory.length,
    inventoryValue: inventory.reduce((total, item) => total + item.price, 0),
    openedCases: caseOpens,
    soldItems: sales._count,
    soldAmount: sales._sum.amount ?? 0,
    spent,
    earned: earned + (sales._sum.amount ?? 0),
  });
}

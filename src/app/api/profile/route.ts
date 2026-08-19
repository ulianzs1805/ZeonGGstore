import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const [inventory, operations, transactions, tickets] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { userId: user.id, soldAt: null }, orderBy: { addedAt: "desc" } }),
    prisma.operation.findMany({ where: { userId: user.id }, include: { item: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.supportTicket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return NextResponse.json({ user, inventory, operations, transactions, tickets });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const [profile, inventory, operations, transactions, tickets] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, avatar: true, role: true, createdAt: true, balance: true },
    }),
    prisma.inventoryItem.findMany({ where: { userId: user.id, soldAt: null }, orderBy: { addedAt: "desc" } }),
    prisma.operation.findMany({ where: { userId: user.id }, include: { item: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.supportTicket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  if (!profile) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  return NextResponse.json({ user: profile, inventory, operations, transactions, tickets });
}

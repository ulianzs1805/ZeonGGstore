import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.inventoryItem.findMany({
    where: { soldAt: null },
    include: { case: { select: { id: true, slug: true, name: true, image: true } }, user: { select: { name: true } } },
    orderBy: { addedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ drops: items.map((item) => ({ id: item.id, itemId: item.itemId, name: item.name, rarity: item.rarity, image: item.image, price: item.price, addedAt: item.addedAt, userName: item.user.name, case: item.case })) });
}
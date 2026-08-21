import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemCatalog } from "@/lib/system-catalog";

export async function GET() {
  await ensureSystemCatalog(prisma);
  const items = await prisma.inventoryItem.findMany({
    where: { soldAt: null },
    include: { case: { select: { id: true, slug: true, name: true, image: true } }, user: { select: { name: true } } },
    orderBy: { addedAt: "desc" },
    take: 50,
  });
  const drops = await prisma.drop.findMany({
    where: { id: { in: items.map((item) => item.itemId) } },
    select: { id: true, name: true, rarity: true, image: true, price: true },
  });
  const dropsById = new Map(drops.map((drop) => [drop.id, drop]));

  return NextResponse.json({
    drops: items.map((item) => {
      const currentDrop = dropsById.get(item.itemId);
      return {
        id: item.id,
        itemId: item.itemId,
        name: currentDrop?.name ?? item.name,
        rarity: currentDrop?.rarity ?? item.rarity,
        image: currentDrop?.image ?? item.image,
        price: currentDrop?.price ?? item.price,
        addedAt: item.addedAt,
        userName: item.user.name,
        case: item.case,
      };
    }),
  });
}
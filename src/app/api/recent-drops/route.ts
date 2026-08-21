import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemCatalog } from "@/lib/system-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSystemCatalog(prisma);

    const items = await prisma.inventoryItem.findMany({
      where: { soldAt: null },
      include: {
        case: { select: { id: true, slug: true, name: true, image: true } },
        user: { select: { name: true } },
      },
      orderBy: { addedAt: "desc" },
      take: 50,
    });

    const drops = await prisma.drop.findMany({
      where: { id: { in: items.map((item) => item.itemId) } },
      select: { id: true, name: true, rarity: true, image: true, price: true },
    });
    const dropsById = new Map(drops.map((drop) => [drop.id, drop]));

    return NextResponse.json(
      {
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
      },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  } catch (error) {
    console.error("GET /api/recent-drops failed", error);
    return NextResponse.json(
      {
        error: "Не удалось загрузить последние дропы",
        message: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}

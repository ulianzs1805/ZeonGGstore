import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemCatalog } from "@/lib/system-catalog";
import { resolveSkinImage } from "@/lib/skin-image";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function validPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.01;
}

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
          const name = currentDrop?.name ?? item.name;
          const image = resolveSkinImage(name, currentDrop?.image ?? item.image);
          const price = validPrice(currentDrop?.price) ? currentDrop!.price : validPrice(item.price) ? item.price : 0;
          return {
            id: item.id,
            itemId: item.itemId,
            name,
            rarity: currentDrop?.rarity ?? item.rarity,
            image,
            price,
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

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { ensureSystemCatalog } from "@/lib/system-catalog";
import { prisma } from "@/lib/prisma";

function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.01;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  // Repair protected/system catalog data before reading inventory so corrupted
  // Float values cannot leak into the profile or upgrader UI.
  await ensureSystemCatalog(prisma);

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

  const itemIds = inventory.map((item) => item.itemId).filter(Boolean);
  const canonicalDrops = itemIds.length
    ? await prisma.drop.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true, rarity: true, image: true, price: true } })
    : [];
  const dropsById = new Map(canonicalDrops.map((drop) => [drop.id, drop]));

  const repairedInventory = inventory.map((item) => {
    const canonical = dropsById.get(item.itemId);
    const price = canonical && isValidPrice(canonical.price) ? canonical.price : isValidPrice(item.price) ? item.price : 0;
    return {
      ...item,
      name: canonical?.name || item.name,
      rarity: canonical?.rarity || item.rarity,
      image: canonical?.image || item.image,
      price,
    };
  });

  return NextResponse.json({ user: profile, inventory: repairedInventory, operations, transactions, tickets });
}

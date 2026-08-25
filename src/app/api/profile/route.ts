import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

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

  // Inventory prices/images are copied when an item is won. Repair the response from
  // the canonical Drop so an old/corrupted Float value can never reach the UI.
  const itemIds = inventory.map((item) => item.itemId).filter(Boolean);
  const canonicalDrops = itemIds.length
    ? await prisma.drop.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true, rarity: true, image: true, price: true } })
    : [];
  const dropsById = new Map(canonicalDrops.map((drop) => [drop.id, drop]));

  const repairedInventory = inventory.map((item) => {
    const canonical = dropsById.get(item.itemId);
    const price = canonical && isValidPrice(canonical.price) ? canonical.price : item.price;
    return {
      ...item,
      name: canonical?.name || item.name,
      rarity: canonical?.rarity || item.rarity,
      image: canonical?.image || item.image,
      price: isValidPrice(price) ? price : 0,
    };
  });

  return NextResponse.json({ user: profile, inventory: repairedInventory, operations, transactions, tickets });
}

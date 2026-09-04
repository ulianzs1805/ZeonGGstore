import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const ACTIVE = ["PENDING", "PROCESSING"] as const;
const parseLabel = (label: string | null) => { try { return label ? JSON.parse(label) as Record<string, unknown> : {}; } catch { return {}; } };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const operations = await prisma.operation.findMany({
    where: { userId: user.id, type: "WITHDRAWAL" },
    include: { item: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ withdrawals: operations.map((operation) => ({
    id: operation.id,
    status: operation.status,
    createdAt: operation.createdAt,
    item: operation.item ? { id: operation.item.id, name: operation.item.name, rarity: operation.item.rarity, image: operation.item.image, price: operation.item.price } : null,
    details: parseLabel(operation.label),
  })) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const inventoryItemId = typeof body?.inventoryItemId === "string" ? body.inventoryItemId.trim() : "";
  const gameId = typeof body?.gameId === "string" ? body.gameId.trim() : "";
  const listingSkinName = typeof body?.listingSkinName === "string" ? body.listingSkinName.trim() : "";
  const listingPriceGold = typeof body?.listingPriceGold === "number" ? body.listingPriceGold : Number(body?.listingPriceGold);

  if (!inventoryItemId) return NextResponse.json({ error: "Не указан предмет" }, { status: 400 });
  if (gameId.length < 3 || gameId.length > 32 || !/^[A-Za-z0-9_-]+$/.test(gameId)) return NextResponse.json({ error: "Проверьте игровой ID" }, { status: 400 });
  if (!listingSkinName || listingSkinName.length > 120) return NextResponse.json({ error: "Укажите предмет, который вы выставите на рынке" }, { status: 400 });
  if (!Number.isInteger(listingPriceGold) || listingPriceGold < 1 || listingPriceGold > 100000) return NextResponse.json({ error: "Некорректная цена выставления" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, userId: user.id, soldAt: null } });
      if (!item) throw new Error("ITEM_NOT_AVAILABLE");
      const active = await tx.operation.findFirst({ where: { userId: user.id, itemId: item.id, type: "WITHDRAWAL", status: { in: [...ACTIVE] } }, select: { id: true } });
      if (active) throw new Error("WITHDRAWAL_EXISTS");
      const operation = await tx.operation.create({
        data: {
          userId: user.id,
          type: "WITHDRAWAL",
          itemId: item.id,
          amount: Math.max(0, Math.round(item.price)),
          status: "PENDING",
          label: JSON.stringify({ gameId, listingSkinName, listingPriceGold, targetItemName: item.name, targetItemPrice: item.price }),
        },
      });
      return { id: operation.id, status: operation.status, item: { id: item.id, name: item.name, rarity: item.rarity, image: item.image, price: item.price }, details: { gameId, listingSkinName, listingPriceGold } };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ITEM_NOT_AVAILABLE") return NextResponse.json({ error: "Предмет уже использован или недоступен" }, { status: 409 });
    if (error instanceof Error && error.message === "WITHDRAWAL_EXISTS") return NextResponse.json({ error: "Для этого предмета уже есть активная заявка на вывод" }, { status: 409 });
    return NextResponse.json({ error: "Не удалось создать заявку на вывод" }, { status: 500 });
  }
}

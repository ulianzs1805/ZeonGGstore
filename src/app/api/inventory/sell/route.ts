import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

function isValidPrice(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value > 0; }

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const inventoryItemId = body && typeof body.inventoryItemId === "string" ? body.inventoryItemId : "";
  const sellAll = body?.sellAll === true;
  if (!inventoryItemId && !sellAll) return NextResponse.json({ error: "Не указан предмет" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const items = sellAll
        ? await transaction.inventoryItem.findMany({ where: { userId: user.id, soldAt: null } })
        : await transaction.inventoryItem.findMany({ where: { id: inventoryItemId, userId: user.id, soldAt: null } });

      if (!items.length) throw new Error("NO_ITEMS");

      const soldAt = new Date();
      let credited = 0;
      const soldIds: string[] = [];

      for (const item of items) {
        const withdrawal = await transaction.operation.findFirst({ where: { userId: user.id, itemId: item.id, type: "WITHDRAWAL", status: { in: ["PENDING", "PROCESSING"] } }, select: { id: true } });
        if (withdrawal) throw new Error("WITHDRAWAL_EXISTS");

        const canonicalDrop = await transaction.drop.findFirst({ where: { id: item.itemId }, select: { name: true, rarity: true, image: true, price: true } });
        const salePrice = canonicalDrop && isValidPrice(canonicalDrop.price) ? canonicalDrop.price : item.price;
        if (!isValidPrice(salePrice)) throw new Error("INVALID_ITEM_PRICE");
        const creditAmount = Math.max(0, Math.round(salePrice));
        if (creditAmount <= 0) throw new Error("INVALID_ITEM_PRICE");

        const claimed = await transaction.inventoryItem.updateMany({ where: { id: item.id, userId: user.id, soldAt: null }, data: { soldAt, ...(canonicalDrop ? { name: canonicalDrop.name, rarity: canonicalDrop.rarity, image: canonicalDrop.image, price: canonicalDrop.price } : {}) } });
        if (claimed.count !== 1) throw new Error("ITEM_NOT_AVAILABLE");

        credited += creditAmount;
        soldIds.push(item.id);
        await transaction.operation.create({ data: { userId: user.id, type: "ITEM_SALE", itemId: item.id, amount: creditAmount, status: "SUCCESS", createdAt: soldAt } });
        await transaction.transaction.create({ data: { userId: user.id, type: "SALE", zCoinAmount: creditAmount, status: "SUCCESS", createdAt: soldAt } });
      }

      const updatedUser = await transaction.user.update({ where: { id: user.id }, data: { balance: { increment: credited } } });
      return { balance: updatedUser.balance, itemIds: soldIds, credited, count: soldIds.length };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ITEMS") return NextResponse.json({ error: "В инвентаре нет предметов для продажи" }, { status: 409 });
    if (error instanceof Error && error.message === "ITEM_NOT_AVAILABLE") return NextResponse.json({ error: "Один из предметов уже продан или недоступен" }, { status: 409 });
    if (error instanceof Error && error.message === "WITHDRAWAL_EXISTS") return NextResponse.json({ error: "Нельзя продать всё: у одного из предметов есть активная заявка на вывод" }, { status: 409 });
    if (error instanceof Error && error.message === "INVALID_ITEM_PRICE") return NextResponse.json({ error: "У одного из предметов некорректная цена" }, { status: 422 });
    return NextResponse.json({ error: "Не удалось завершить продажу" }, { status: 500 });
  }
}

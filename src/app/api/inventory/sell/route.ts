import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const inventoryItemId = body && typeof body.inventoryItemId === "string" ? body.inventoryItemId : "";
  if (!inventoryItemId) return NextResponse.json({ error: "Не указан предмет" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const item = await transaction.inventoryItem.findFirst({
        where: { id: inventoryItemId, userId: user.id, soldAt: null },
      });
      if (!item) throw new Error("ITEM_NOT_AVAILABLE");

      // Never credit a corrupted copied Float from inventory when a canonical Drop exists.
      const canonicalDrop = await transaction.drop.findFirst({
        where: { id: item.itemId },
        select: { name: true, rarity: true, image: true, price: true },
      });
      const salePrice = canonicalDrop && isValidPrice(canonicalDrop.price) ? canonicalDrop.price : item.price;
      if (!isValidPrice(salePrice)) throw new Error("INVALID_ITEM_PRICE");

      const creditAmount = Math.max(0, Math.round(salePrice));
      if (creditAmount <= 0) throw new Error("INVALID_ITEM_PRICE");

      const soldAt = new Date();
      const claimed = await transaction.inventoryItem.updateMany({
        where: { id: item.id, userId: user.id, soldAt: null },
        data: {
          soldAt,
          ...(canonicalDrop ? {
            name: canonicalDrop.name,
            rarity: canonicalDrop.rarity,
            image: canonicalDrop.image,
            price: canonicalDrop.price,
          } : {}),
        },
      });
      if (claimed.count !== 1) throw new Error("ITEM_NOT_AVAILABLE");

      const updatedUser = await transaction.user.update({
        where: { id: user.id },
        data: { balance: { increment: creditAmount } },
      });
      const operation = await transaction.operation.create({
        data: { userId: user.id, type: "ITEM_SALE", itemId: item.id, amount: creditAmount, status: "SUCCESS", createdAt: soldAt },
      });
      await transaction.transaction.create({
        data: { userId: user.id, type: "SALE", zCoinAmount: creditAmount, status: "SUCCESS", createdAt: soldAt },
      });

      return { balance: updatedUser.balance, itemId: item.id, salePrice, credited: creditAmount, operation };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ITEM_NOT_AVAILABLE") {
      return NextResponse.json({ error: "Предмет уже продан или недоступен" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "INVALID_ITEM_PRICE") {
      return NextResponse.json({ error: "У предмета некорректная цена" }, { status: 422 });
    }
    return NextResponse.json({ error: "Не удалось завершить продажу" }, { status: 500 });
  }
}

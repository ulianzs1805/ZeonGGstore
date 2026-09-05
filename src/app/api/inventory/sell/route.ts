import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

type SellAllItem = {
  id: string;
  itemId: string;
  price: number;
  creditAmount: number;
};

async function getSellAllItems(transaction: Prisma.TransactionClient, userId: string): Promise<SellAllItem[]> {
  const items = await transaction.inventoryItem.findMany({
    where: { userId, soldAt: null },
    select: { id: true, itemId: true, price: true },
  });
  if (!items.length) throw new Error("NO_ITEMS");

  const itemIds = items.map((item) => item.id);
  const dropIds = [...new Set(items.map((item) => item.itemId))];

  const [withdrawals, drops] = await Promise.all([
    transaction.operation.findMany({
      where: {
        userId,
        itemId: { in: itemIds },
        type: "WITHDRAWAL",
        status: { in: ["PENDING", "PROCESSING"] },
      },
      select: { itemId: true },
    }),
    transaction.drop.findMany({
      where: { id: { in: dropIds } },
      select: { id: true, price: true },
    }),
  ]);

  if (withdrawals.length) throw new Error("WITHDRAWAL_EXISTS");

  const dropsById = new Map(drops.map((drop) => [drop.id, drop.price]));

  return items.map((item) => {
    const canonicalPrice = dropsById.get(item.itemId);
    const salePrice = canonicalPrice !== undefined && isValidPrice(canonicalPrice) ? canonicalPrice : item.price;
    if (!isValidPrice(salePrice)) throw new Error("INVALID_ITEM_PRICE");

    const creditAmount = Math.max(0, Math.round(salePrice));
    if (creditAmount <= 0) throw new Error("INVALID_ITEM_PRICE");

    return { id: item.id, itemId: item.itemId, price: salePrice, creditAmount };
  });
}

async function calculateSellAll(transaction: Prisma.TransactionClient, userId: string) {
  const items = await getSellAllItems(transaction, userId);
  return {
    credited: items.reduce((sum, item) => sum + item.creditAmount, 0),
    count: items.length,
    itemIds: items.map((item) => item.id),
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const inventoryItemId = body && typeof body.inventoryItemId === "string" ? body.inventoryItemId : "";
  const sellAll = body?.sellAll === true;
  const preview = body?.preview === true;

  if (!inventoryItemId && !sellAll) return NextResponse.json({ error: "Не указан предмет" }, { status: 400 });
  if (preview && !sellAll) return NextResponse.json({ error: "Предпросмотр доступен только для продажи всего инвентаря" }, { status: 400 });

  try {
    if (preview) {
      const result = await prisma.$transaction((transaction) => calculateSellAll(transaction, user.id));
      return NextResponse.json(result);
    }

    const result = await prisma.$transaction(async (transaction) => {
      if (sellAll) {
        const items = await getSellAllItems(transaction, user.id);
        const soldAt = new Date();
        const credited = items.reduce((sum, item) => sum + item.creditAmount, 0);
        const itemIds = items.map((item) => item.id);

        const claimed = await transaction.inventoryItem.updateMany({
          where: { userId: user.id, id: { in: itemIds }, soldAt: null },
          data: { soldAt },
        });
        if (claimed.count !== items.length) throw new Error("ITEM_NOT_AVAILABLE");

        await transaction.operation.createMany({
          data: items.map((item) => ({
            userId: user.id,
            type: "ITEM_SALE",
            itemId: item.id,
            amount: item.creditAmount,
            status: "SUCCESS",
            createdAt: soldAt,
          })),
        });

        await transaction.transaction.createMany({
          data: items.map((item) => ({
            userId: user.id,
            type: "SALE",
            zCoinAmount: item.creditAmount,
            status: "SUCCESS",
            createdAt: soldAt,
          })),
        });

        const updatedUser = await transaction.user.update({
          where: { id: user.id },
          data: { balance: { increment: credited } },
        });

        return { balance: updatedUser.balance, itemIds, credited, count: items.length };
      }

      const item = await transaction.inventoryItem.findFirst({
        where: { id: inventoryItemId, userId: user.id, soldAt: null },
      });
      if (!item) throw new Error("NO_ITEMS");

      const withdrawal = await transaction.operation.findFirst({
        where: {
          userId: user.id,
          itemId: item.id,
          type: "WITHDRAWAL",
          status: { in: ["PENDING", "PROCESSING"] },
        },
        select: { id: true },
      });
      if (withdrawal) throw new Error("WITHDRAWAL_EXISTS");

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
          ...(canonicalDrop
            ? { name: canonicalDrop.name, rarity: canonicalDrop.rarity, image: canonicalDrop.image, price: canonicalDrop.price }
            : {}),
        },
      });
      if (claimed.count !== 1) throw new Error("ITEM_NOT_AVAILABLE");

      await transaction.operation.create({
        data: { userId: user.id, type: "ITEM_SALE", itemId: item.id, amount: creditAmount, status: "SUCCESS", createdAt: soldAt },
      });
      await transaction.transaction.create({
        data: { userId: user.id, type: "SALE", zCoinAmount: creditAmount, status: "SUCCESS", createdAt: soldAt },
      });

      const updatedUser = await transaction.user.update({
        where: { id: user.id },
        data: { balance: { increment: creditAmount } },
      });
      return { balance: updatedUser.balance, itemIds: [item.id], credited: creditAmount, count: 1 };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[inventory/sell] failed", error);
    if (error instanceof Error && error.message === "NO_ITEMS") return NextResponse.json({ error: "В инвентаре нет предметов для продажи" }, { status: 409 });
    if (error instanceof Error && error.message === "ITEM_NOT_AVAILABLE") return NextResponse.json({ error: "Один из предметов уже продан или недоступен" }, { status: 409 });
    if (error instanceof Error && error.message === "WITHDRAWAL_EXISTS") return NextResponse.json({ error: "Нельзя продать всё: у одного из предметов есть активная заявка на вывод" }, { status: 409 });
    if (error instanceof Error && error.message === "INVALID_ITEM_PRICE") return NextResponse.json({ error: "У одного из предметов некорректная цена" }, { status: 422 });
    return NextResponse.json({ error: "Не удалось завершить продажу" }, { status: 500 });
  }
}

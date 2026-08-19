import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

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

      const soldAt = new Date();
      const updatedUser = await transaction.user.update({
        where: { id: user.id },
        data: { balance: { increment: item.price } },
      });
      await transaction.inventoryItem.update({ where: { id: item.id }, data: { soldAt } });
      const operation = await transaction.operation.create({
        data: { userId: user.id, type: "ITEM_SALE", itemId: item.id, amount: item.price, status: "SUCCESS", createdAt: soldAt },
      });
      await transaction.transaction.create({
        data: { userId: user.id, type: "SALE", zCoinAmount: item.price, status: "SUCCESS", createdAt: soldAt },
      });

      return { balance: updatedUser.balance, itemId: item.id, operation };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ITEM_NOT_AVAILABLE") {
      return NextResponse.json({ error: "Предмет уже продан или недоступен" }, { status: 409 });
    }
    return NextResponse.json({ error: "Не удалось завершить продажу" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const ACTIVE = ["PENDING", "PROCESSING"] as const;
const parseLabel = (label: string | null) => { try { return label ? JSON.parse(label) as Record<string, unknown> : {}; } catch { return {}; } };

const MAX_AVATAR_LENGTH = 5 * 1024 * 1024;
const AVATAR_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i;

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
  const listingSkinName = typeof body?.listingSkinName === "string" ? body.listingSkinName.trim() : "";
  const pattern = typeof body?.pattern === "string" ? body.pattern.trim() : "";
  const stickerCount = typeof body?.stickerCount === "number" ? body.stickerCount : Number(body?.stickerCount);
  const stickers = Array.isArray(body?.stickers) ? body.stickers.filter((value): value is string => typeof value === "string").map((value) => value.trim()) : [];
  const avatarDataUrl = typeof body?.avatarDataUrl === "string" ? body.avatarDataUrl : "";
  const listingPriceGold = typeof body?.listingPriceGold === "number" ? body.listingPriceGold : Number(body?.listingPriceGold);

  if (!inventoryItemId) return NextResponse.json({ error: "Не указан предмет" }, { status: 400 });
  if (!listingSkinName || listingSkinName.length > 120) return NextResponse.json({ error: "Укажите скин, который выставите на рынке" }, { status: 400 });
  if (!pattern || pattern.length > 32) return NextResponse.json({ error: "Укажите Pattern" }, { status: 400 });
  if (!Number.isInteger(stickerCount) || stickerCount < 0 || stickerCount > 4) return NextResponse.json({ error: "Количество наклеек должно быть от 0 до 4" }, { status: 400 });
  if (stickers.length !== stickerCount || stickers.some((sticker) => !sticker || sticker.length > 120)) return NextResponse.json({ error: "Заполните названия всех выбранных наклеек" }, { status: 400 });
  if (!avatarDataUrl || avatarDataUrl.length > MAX_AVATAR_LENGTH || !AVATAR_RE.test(avatarDataUrl)) return NextResponse.json({ error: "Загрузите аватар Standoff 2 в PNG, JPG или WEBP" }, { status: 400 });
  if (!Number.isInteger(listingPriceGold) || listingPriceGold < 1 || listingPriceGold > 100000) return NextResponse.json({ error: "Некорректная цена на рынке" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, userId: user.id, soldAt: null } });
      if (!item) throw new Error("ITEM_NOT_AVAILABLE");
      const active = await tx.operation.findFirst({ where: { userId: user.id, itemId: item.id, type: "WITHDRAWAL", status: { in: [...ACTIVE] } }, select: { id: true } });
      if (active) throw new Error("WITHDRAWAL_EXISTS");

      const desiredGold = Math.max(0, Math.round(item.price));
      const calculatedListingPriceGold = Math.ceil(desiredGold / 0.8);
      const expectedReceivedGold = calculatedListingPriceGold * 0.8;
      if (listingPriceGold !== calculatedListingPriceGold) throw new Error("INVALID_MARKET_PRICE");

      const details = {
        listingSkinName,
        pattern,
        stickerCount,
        stickers,
        avatarDataUrl,
        targetItemName: item.name,
        targetItemPrice: item.price,
        desiredGold,
        listingPriceGold: calculatedListingPriceGold,
        expectedReceivedGold,
        marketplaceCommissionPercent: 20,
      };
      const operation = await tx.operation.create({
        data: {
          userId: user.id,
          type: "WITHDRAWAL",
          itemId: item.id,
          amount: desiredGold,
          status: "PENDING",
          label: JSON.stringify(details),
        },
      });
      return { id: operation.id, status: operation.status, item: { id: item.id, name: item.name, rarity: item.rarity, image: item.image, price: item.price }, details };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ITEM_NOT_AVAILABLE") return NextResponse.json({ error: "Предмет уже использован или недоступен" }, { status: 409 });
    if (error instanceof Error && error.message === "WITHDRAWAL_EXISTS") return NextResponse.json({ error: "Для этого предмета уже есть активная заявка на вывод" }, { status: 409 });
    if (error instanceof Error && error.message === "INVALID_MARKET_PRICE") return NextResponse.json({ error: "Цена должна совпадать с рассчитанной ценой для Marketplace" }, { status: 400 });
    return NextResponse.json({ error: "Не удалось создать заявку на вывод" }, { status: 500 });
  }
}

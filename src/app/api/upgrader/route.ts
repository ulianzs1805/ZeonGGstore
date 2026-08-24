import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getCurrentUser } from "@/lib/current-user";
import { ensureSystemCatalog } from "@/lib/system-catalog";
import { prisma } from "@/lib/prisma";

const MIN_ITEMS = 3;
const MAX_ITEMS = 10;
const MIN_TOTAL = 15;
const MIN_CHANCE = 0.1;

function chanceFor(inputValue: number, targetValue: number) {
  if (inputValue <= 0 || targetValue <= 0) return MIN_CHANCE;
  return Math.max(MIN_CHANCE, Math.min(100, (inputValue / targetValue) * 100));
}

function publicItem(item: { id: string; name: string; rarity: string; image: string; price: number }) {
  return { id: item.id, name: item.name, rarity: item.rarity, image: item.image, price: item.price };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  await ensureSystemCatalog(prisma);

  const [inventory, drops] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { userId: user.id, soldAt: null },
      orderBy: { addedAt: "desc" },
      select: { id: true, name: true, rarity: true, image: true, price: true },
    }),
    prisma.drop.findMany({
      where: { case: { environment: "SYSTEM", isActive: true } },
      orderBy: [{ price: "asc" }, { name: "asc" }],
      select: { id: true, name: true, rarity: true, image: true, price: true },
    }),
  ]);

  const uniqueTargets = Array.from(new Map(drops.map((drop) => [drop.id, drop])).values());
  return NextResponse.json({ inventory, targets: uniqueTargets });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => null) as { itemIds?: unknown; targetId?: unknown; idempotencyKey?: unknown } | null;
  const itemIds = Array.isArray(body?.itemIds) ? body.itemIds.filter((id): id is string => typeof id === "string") : [];
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 100) : "";

  if (!idempotencyKey) return NextResponse.json({ error: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 });
  if (itemIds.length < MIN_ITEMS) return NextResponse.json({ error: "MIN_ITEMS", min: MIN_ITEMS }, { status: 400 });
  if (itemIds.length > MAX_ITEMS) return NextResponse.json({ error: "MAX_ITEMS", max: MAX_ITEMS }, { status: 400 });
  if (new Set(itemIds).size !== itemIds.length) return NextResponse.json({ error: "DUPLICATE_ITEMS" }, { status: 400 });
  if (!targetId) return NextResponse.json({ error: "TARGET_REQUIRED" }, { status: 400 });

  const previous = await prisma.operation.findUnique({
    where: { idempotencyKey },
    include: { item: true },
  });
  if (previous) {
    return NextResponse.json({
      ok: previous.status === "SUCCESS",
      replay: true,
      status: previous.status,
      resultItem: previous.item ? publicItem(previous.item) : null,
    });
  }

  await ensureSystemCatalog(prisma);

  const result = await prisma.$transaction(async (tx) => {
    const [items, target] = await Promise.all([
      tx.inventoryItem.findMany({
        where: { id: { in: itemIds }, userId: user.id, soldAt: null },
        select: { id: true, name: true, rarity: true, image: true, price: true },
      }),
      tx.drop.findFirst({
        where: { id: targetId, case: { environment: "SYSTEM", isActive: true } },
        select: { id: true, name: true, rarity: true, image: true, price: true },
      }),
    ]);

    if (items.length !== itemIds.length) throw new Error("ITEMS_NOT_AVAILABLE");
    if (!target) throw new Error("TARGET_NOT_FOUND");

    const inputValue = items.reduce((sum, item) => sum + item.price, 0);
    if (inputValue < MIN_TOTAL) throw new Error("MIN_TOTAL");

    const chance = chanceFor(inputValue, target.price);
    const roll = randomInt(0, 1_000_000) / 10_000;
    const success = roll < chance;
    const now = new Date();

    const consumed = await tx.inventoryItem.updateMany({
      where: { id: { in: itemIds }, userId: user.id, soldAt: null },
      data: { soldAt: now },
    });
    if (consumed.count !== itemIds.length) throw new Error("ITEMS_CHANGED");

    await tx.operation.create({
      data: {
        userId: user.id,
        type: success ? "UPGRADE_WIN" : "UPGRADE_LOSS",
        label: success ? `Апгрейд → ${target.name}` : `Апгрейд → ${target.name} (неудача)`,
        amount: -inputValue,
        status: success ? "SUCCESS" : "FAILED",
        idempotencyKey,
      },
    });

    if (!success) return { success, chance, roll, target: publicItem(target), resultItem: null };

    const resultItem = await tx.inventoryItem.create({
      data: {
        userId: user.id,
        itemId: target.id,
        name: target.name,
        rarity: target.rarity,
        image: target.image,
        price: target.price,
      },
    });

    await tx.operation.create({
      data: {
        userId: user.id,
        type: "UPGRADE_REWARD",
        itemId: resultItem.id,
        label: `Получен ${target.name}`,
        amount: target.price,
        status: "SUCCESS",
        idempotencyKey: `${idempotencyKey}:reward`,
      },
    });

    return { success, chance, roll, target: publicItem(target), resultItem: publicItem(resultItem) };
  }).catch((error: unknown) => {
    const code = error instanceof Error ? error.message : "UPGRADE_FAILED";
    const status = code === "ITEMS_NOT_AVAILABLE" || code === "ITEMS_CHANGED" ? 409 : 400;
    throw Object.assign(new Error(code), { status });
  });

  return NextResponse.json(result);
}

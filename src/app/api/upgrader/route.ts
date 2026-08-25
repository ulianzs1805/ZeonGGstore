import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getCurrentUser } from "@/lib/current-user";
import { ensureSystemCatalog } from "@/lib/system-catalog";
import { prisma } from "@/lib/prisma";

const MIN_CHANCE = 0.1;
const MAX_CHANCE = 100;
const CHANCE_BANDS = [
  { min: 30, max: 39.99 },
  { min: 50, max: 59.99 },
  { min: 70, max: 79.99 },
] as const;
const MULTIPLIERS = [2, 5, 10] as const;

function chanceFor(inputValue: number, targetValue: number) {
  if (!Number.isFinite(inputValue) || !Number.isFinite(targetValue) || inputValue <= 0 || targetValue <= 0) return MIN_CHANCE;
  return Math.max(MIN_CHANCE, Math.min(MAX_CHANCE, (inputValue / targetValue) * 100));
}

function publicItem(item: { id: string; name: string; rarity: string; image: string; price: number }) {
  return { id: item.id, name: item.name, rarity: item.rarity, image: item.image, price: item.price };
}

function isAllowedUpgrade(totalInputValue: number, targetPrice: number) {
  if (!Number.isFinite(totalInputValue) || !Number.isFinite(targetPrice) || totalInputValue <= 0 || targetPrice <= totalInputValue) return false;
  const chance = chanceFor(totalInputValue, targetPrice);
  if (CHANCE_BANDS.some((band) => chance >= band.min && chance <= band.max)) return true;
  const ratio = targetPrice / totalInputValue;
  return MULTIPLIERS.some((multiplier) => {
    const tolerance = multiplier * 0.1;
    return ratio >= multiplier - tolerance && ratio <= multiplier + tolerance;
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  await ensureSystemCatalog(prisma);

  const [inventory, drops, balance] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { userId: user.id, soldAt: null }, orderBy: { addedAt: "desc" }, select: { id: true, name: true, rarity: true, image: true, price: true } }),
    prisma.drop.findMany({ where: { case: { environment: "SYSTEM", isActive: true } }, orderBy: [{ price: "asc" }, { name: "asc" }], select: { id: true, name: true, rarity: true, image: true, price: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } }),
  ]);

  return NextResponse.json({ inventory, targets: drops, balance: balance?.balance ?? 0 });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => null) as { itemId?: unknown; targetId?: unknown; idempotencyKey?: unknown; balanceTopUp?: unknown } | null;
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 100) : "";
  const balanceTopUp = typeof body?.balanceTopUp === "number" && Number.isFinite(body.balanceTopUp) ? Math.floor(body.balanceTopUp) : 0;

  if (!idempotencyKey) return NextResponse.json({ error: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 });
  if (!targetId) return NextResponse.json({ error: "TARGET_REQUIRED" }, { status: 400 });
  if (balanceTopUp < 0) return NextResponse.json({ error: "INVALID_BALANCE_TOP_UP" }, { status: 400 });

  const previous = await prisma.operation.findUnique({ where: { idempotencyKey } });
  if (previous) {
    const reward = previous.status === "SUCCESS" ? await prisma.operation.findUnique({ where: { idempotencyKey: `${idempotencyKey}:reward` }, include: { item: true } }) : null;
    return NextResponse.json({ ok: previous.status === "SUCCESS", replay: true, status: previous.status, resultItem: reward?.item ? publicItem(reward.item) : null });
  }

  await ensureSystemCatalog(prisma);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [item, target, freshUser] = await Promise.all([
        itemId ? tx.inventoryItem.findFirst({ where: { id: itemId, userId: user.id, soldAt: null }, select: { id: true, name: true, rarity: true, image: true, price: true } }) : Promise.resolve(null),
        tx.drop.findFirst({ where: { id: targetId, case: { environment: "SYSTEM", isActive: true } }, select: { id: true, name: true, rarity: true, image: true, price: true } }),
        tx.user.findUnique({ where: { id: user.id }, select: { balance: true } }),
      ]);

      if (itemId && !item) throw new Error("ITEMS_NOT_AVAILABLE");
      if (!target) throw new Error("TARGET_NOT_FOUND");
      if (!freshUser) throw new Error("USER_NOT_FOUND");

      const inputValue = item?.price ?? balanceTopUp;
      const totalInputValue = item ? item.price + balanceTopUp : balanceTopUp;

      if (!Number.isFinite(inputValue) || !Number.isFinite(totalInputValue) || !Number.isFinite(target.price) || inputValue <= 0 || totalInputValue <= 0) {
        throw new Error("INPUT_VALUE_INVALID");
      }
      if (target.price <= totalInputValue) throw new Error("TARGET_MUST_BE_MORE_EXPENSIVE");
      if (balanceTopUp > freshUser.balance) throw new Error("INSUFFICIENT_BALANCE");

      // The server is authoritative: calculate the real chance from DB prices.
      // The client does not send or control the chance/mode.
      const chance = chanceFor(totalInputValue, target.price);
      if (!isAllowedUpgrade(totalInputValue, target.price)) {
        // Keep the strict mode protection, but return a useful machine-readable
        // error so the UI can immediately select another valid target instead
        // of leaving the user stuck on an impossible target.
        throw new Error(`UPGRADE_MODE_NOT_ALLOWED:${chance.toFixed(2)}`);
      }

      const roll = randomInt(0, 1_000_000) / 10_000;
      const success = roll < chance;
      const now = new Date();

      if (item) {
        const consumed = await tx.inventoryItem.updateMany({ where: { id: item.id, userId: user.id, soldAt: null }, data: { soldAt: now } });
        if (consumed.count !== 1) throw new Error("ITEMS_CHANGED");
      }

      if (balanceTopUp > 0) {
        const updatedUser = await tx.user.updateMany({ where: { id: user.id, balance: { gte: balanceTopUp } }, data: { balance: { decrement: balanceTopUp } } });
        if (updatedUser.count !== 1) throw new Error("BALANCE_CHANGED");
      }

      await tx.operation.create({ data: { userId: user.id, type: success ? "UPGRADE_WIN" : "UPGRADE_LOSS", label: success ? `Апгрейд → ${target.name}` : `Апгрейд → ${target.name} (неудача)`, amount: -totalInputValue, status: success ? "SUCCESS" : "FAILED", idempotencyKey } });

      const inputItem = item ? publicItem(item) : { id: "balance", name: "Баланс Z-Coin", rarity: "BALANCE", image: "", price: 0 };
      if (!success) return { success, chance, roll, target: publicItem(target), resultItem: null, inputItem, inputValue, balanceTopUp, totalInputValue };

      const resultItem = await tx.inventoryItem.create({ data: { userId: user.id, itemId: target.id, name: target.name, rarity: target.rarity, image: target.image, price: target.price } });
      await tx.operation.create({ data: { userId: user.id, type: "UPGRADE_REWARD", itemId: resultItem.id, label: `Получен ${target.name}`, amount: target.price, status: "SUCCESS", idempotencyKey: `${idempotencyKey}:reward` } });

      return { success, chance, roll, target: publicItem(target), resultItem: publicItem(resultItem), inputItem, inputValue, balanceTopUp, totalInputValue };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "UPGRADE_FAILED";
    const baseCode = code.startsWith("UPGRADE_MODE_NOT_ALLOWED") ? "UPGRADE_MODE_NOT_ALLOWED" : code;
    const status = ["ITEMS_NOT_AVAILABLE", "ITEMS_CHANGED", "BALANCE_CHANGED", "TARGET_MUST_BE_MORE_EXPENSIVE", "UPGRADE_MODE_NOT_ALLOWED", "INPUT_VALUE_INVALID"].includes(baseCode) ? 409 : 400;
    return NextResponse.json({ error: baseCode }, { status });
  }
}

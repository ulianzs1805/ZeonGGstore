import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { resolveSkinImage } from "@/lib/skin-image";

const CASE_IMAGE = "/cases/recovery-body.svg";
const RECOVERY_CASE_CHANCE = 0.5;
const REEL_SIZE = 31;
// A failed-upgrade recovery can still lose value, but never more than 75% of
// the lost amount. Example: a 2,000 Z loss can recover only from 500 Z upward.
// This is enforced on the server before the reward is created.
const RECOVERY_MIN_RATIO = 0.25;
const publicItem = (item: { id: string; name: string; rarity: string; image: string; price: number }) => ({ id: item.id, name: item.name, rarity: item.rarity, image: resolveSkinImage(item.name, item.image), price: Number(item.price) || 0 });

type RecoveryDrop = { id: string; caseId: string; name: string; rarity: string; image: string; price: number };

type RecoveryMeta = { lostItemName?: string; lostItemImage?: string; lostItemRarity?: string; lostValue?: number };

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function recoveryWeight(price: number, lostValue: number) {
  if (!Number.isFinite(price) || !Number.isFinite(lostValue) || price <= 0 || lostValue <= 0) return 0;
  const ratio = price / lostValue;
  // Never weight an item below the recovery floor.
  if (ratio < RECOVERY_MIN_RATIO) return 0;
  if (ratio <= 1) {
    return 0.2 + 1.35 * Math.exp(-Math.pow((1 - ratio) / 0.42, 2));
  }
  return 0.0005 + 0.95 * Math.exp(-Math.pow(Math.log(ratio) / 0.38, 2));
}

function weightedPick(items: RecoveryDrop[], lostValue: number) {
  const minRecoveryValue = lostValue * RECOVERY_MIN_RATIO;
  const eligible = items.filter((item) => Number(item.price) >= minRecoveryValue && Number(item.price) > 0);
  if (!eligible.length) return null;
  const weighted = eligible.map((item) => ({ item, weight: recoveryWeight(Number(item.price), lostValue) })).filter((entry) => entry.weight > 0);
  if (!weighted.length) return eligible[randomInt(eligible.length)];
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = (randomInt(1_000_000) / 1_000_000) * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return weighted[weighted.length - 1].item;
}

async function parseMeta(label: string | null) {
  try { return JSON.parse(label || "{}") as RecoveryMeta; } catch { return {}; }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const op = await prisma.operation.findFirst({ where: { userId: user.id, type: "UPGRADE_RECOVERY_CASE", status: "OPEN" }, orderBy: { createdAt: "desc" } });
  if (!op) return NextResponse.json({ recoveryCase: null });
  const meta = await parseMeta(op.label);
  return NextResponse.json({ recoveryCase: { id: op.id, image: CASE_IMAGE, ...meta } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { recoveryCaseId?: unknown; idempotencyKey?: unknown } | null;
  const recoveryCaseId = typeof body?.recoveryCaseId === "string" ? body.recoveryCaseId : "";
  const key = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 100) : "";
  if (!recoveryCaseId || !key) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const replay = await prisma.operation.findUnique({ where: { idempotencyKey: key }, include: { item: true } });
  if (replay) {
    if (replay.type === "UPGRADE_RECOVERY_REWARD" && replay.item) return NextResponse.json({ ok: true, replay: true, resultItem: publicItem(replay.item) });
    return NextResponse.json({ error: "REPLAY" }, { status: 409 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const op = await tx.operation.findFirst({ where: { id: recoveryCaseId, userId: user.id, type: "UPGRADE_RECOVERY_CASE" }, include: { item: true } });
      if (!op) throw new Error("RECOVERY_CASE_NOT_FOUND");

      if (op.status === "CONSUMED" && op.item) {
        const meta = await parseMeta(op.label);
        return { recoveryCaseId: op.id, resultItem: publicItem(op.item), reelItems: [publicItem(op.item)], reelTargetIndex: 0, lostValue: Number(meta.lostValue) || 0, alreadyConsumed: true };
      }
      if (op.status !== "OPEN") throw new Error("RECOVERY_CASE_NOT_FOUND");

      const meta = await parseMeta(op.label);
      const lostValue = Number(meta.lostValue) || 0;
      if (lostValue <= 0) throw new Error("RECOVERY_VALUE_INVALID");
      const minRecoveryValue = lostValue * RECOVERY_MIN_RATIO;

      const drops = await tx.drop.findMany({
        where: { case: { isActive: true }, price: { gte: minRecoveryValue } },
        orderBy: [{ price: "asc" }, { name: "asc" }],
        select: { id: true, caseId: true, name: true, rarity: true, image: true, price: true },
      });
      if (!drops.length) throw new Error("RECOVERY_POOL_EMPTY");

      const target = weightedPick(drops, lostValue);
      if (!target) throw new Error("RECOVERY_POOL_EMPTY");

      const nearby = [...drops]
        .sort((a, b) => Math.abs(Number(a.price) - lostValue) - Math.abs(Number(b.price) - lostValue))
        .slice(0, Math.min(12, drops.length));
      const pool = nearby.some((item) => item.id === target.id) ? nearby : [target, ...nearby.slice(0, 11)];
      const shuffled = shuffle(pool);
      const reelPool = Array.from({ length: REEL_SIZE }, (_, index) => shuffled[index % shuffled.length]);
      const targetIndex = 24;
      reelPool[targetIndex] = target;
      const reelItems = reelPool.map((item, index) => ({ ...publicItem(item), id: `${item.id}-${index}` }));

      const item = await tx.inventoryItem.create({
        data: {
          userId: user.id,
          itemId: target.id,
          caseId: target.caseId,
          name: target.name,
          rarity: target.rarity,
          image: target.image,
          price: target.price,
        },
      });
      await tx.operation.update({ where: { id: op.id }, data: { status: "CONSUMED", itemId: item.id } });
      await tx.operation.create({ data: { userId: user.id, type: "UPGRADE_RECOVERY_REWARD", itemId: item.id, amount: Math.round(target.price), status: "SUCCESS", label: `Кейс отыгрыша → ${target.name}`, idempotencyKey: key } });
      return { recoveryCaseId: op.id, resultItem: publicItem(item), reelItems, reelTargetIndex: targetIndex, lostValue, minRecoveryValue, alreadyConsumed: false };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "RECOVERY_FAILED";
    return NextResponse.json({ error: code }, { status: code === "RECOVERY_CASE_NOT_FOUND" ? 404 : 400 });
  }
}

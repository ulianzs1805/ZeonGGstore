import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const weightedPick = <T,>(items: Array<{ item: T; weight: number }>) => {
  const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let cursor = Math.random() * total;
  for (const entry of items) {
    cursor -= Math.max(0, entry.weight);
    if (cursor <= 0) return entry.item;
  }
  return items[items.length - 1].item;
};

const depositValues = [5, 10, 15, 20, 25, 30];
const balanceValues = [5, 10, 15, 25, 35, 50];

const wheel = [
  { type: "DEPOSIT", label: "Депозит", icon: "%", weight: 18 },
  { type: "CASE", label: "Бесплатный кейс", icon: "▣", weight: 18 },
  { type: "BALANCE", label: "Бесплатный баланс", icon: "Z", weight: 16 },
  { type: "ZCOIN", label: "Z-Coin", icon: "Z", weight: 15 },
  { type: "ZCOIN", label: "Большой Z-Coin", icon: "Z", weight: 8 },
  { type: "DEPOSIT", label: "Депозит", icon: "%", weight: 10 },
  { type: "CASE", label: "Бесплатный кейс", icon: "▣", weight: 8 },
  { type: "BALANCE", label: "Бесплатный баланс", icon: "Z", weight: 7 },
] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const cases = await prisma.case.findMany({
    where: { isActive: true, environment: "SYSTEM" },
    select: { id: true, slug: true, name: true, image: true, price: true },
    orderBy: { price: "asc" },
  });
  const bonusInventory = await prisma.operation.findMany({
    where: { userId: user.id, type: { in: ["FORTUNE_DEPOSIT", "FORTUNE_ZCOIN"] }, status: "UNUSED" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ wheel, cases, bonusInventory });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const body = await request.json().catch(() => null) as { idempotencyKey?: unknown } | null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.length > 8 ? body.idempotencyKey : crypto.randomUUID();

  const existing = await prisma.fortuneSpin.findUnique({ where: { idempotencyKey } });
  if (existing) return NextResponse.json({ ok: true, rewardType: existing.rewardType, rewardValue: existing.rewardValue, caseId: existing.caseId, replay: true });

  const reward = weightedPick(wheel.map((item) => ({ item, weight: item.weight })));
  const cases = await prisma.case.findMany({
    where: { isActive: true, environment: "SYSTEM" },
    select: { id: true, slug: true, name: true, image: true, price: true },
    orderBy: { price: "asc" },
  });
  if (reward.type === "CASE" && !cases.length) return NextResponse.json({ error: "Сейчас нет доступных кейсов." }, { status: 409 });

  let rewardValue: number | null = null;
  let caseId: string | null = null;
  let resultLabel = reward.label;

  if (reward.type === "DEPOSIT") {
    rewardValue = weightedPick(depositValues.map((value) => ({ item: value, weight: 36 - value })));
    const code = `DEP${rewardValue}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    await prisma.operation.create({
      data: { userId: user.id, type: "FORTUNE_DEPOSIT", label: JSON.stringify({ code, percent: rewardValue }), amount: rewardValue, status: "UNUSED", idempotencyKey: `fortune-deposit-${idempotencyKey}` },
    });
    resultLabel = `Депозит +${rewardValue}%`;
  } else if (reward.type === "CASE") {
    const selected = weightedPick(cases.map((item) => ({ item, weight: 1 / Math.max(1, item.price) })));
    caseId = selected.id;
    resultLabel = `Бесплатный кейс: ${selected.name}`;
    await prisma.freeCaseGrant.create({ data: { userId: user.id, caseId: selected.id } });
  } else if (reward.type === "BALANCE") {
    rewardValue = weightedPick(balanceValues.map((value) => ({ item: value, weight: 56 - value })));
    await prisma.user.update({ where: { id: user.id }, data: { balance: { increment: rewardValue } } });
    await prisma.transaction.create({ data: { userId: user.id, type: "FORTUNE_BALANCE", zCoinAmount: rewardValue, status: "SUCCESS" } });
    await prisma.operation.create({ data: { userId: user.id, type: "FORTUNE_ZCOIN", label: `Колесо фортуны: +${rewardValue} Z-Coin`, amount: rewardValue, status: "USED", idempotencyKey: `fortune-zcoin-${idempotencyKey}` } });
    resultLabel = `Бесплатный баланс: +${rewardValue} Z-Coin`;
  } else {
    rewardValue = reward.label === "Большой Z-Coin" ? 50 : 25;
    await prisma.user.update({ where: { id: user.id }, data: { balance: { increment: rewardValue } } });
    await prisma.transaction.create({ data: { userId: user.id, type: "FORTUNE_ZCOIN", zCoinAmount: rewardValue, status: "SUCCESS" } });
    resultLabel = `+${rewardValue} Z-Coin`;
  }

  const spin = await prisma.fortuneSpin.create({ data: { userId: user.id, rewardType: reward.type, rewardValue, caseId, idempotencyKey } });
  return NextResponse.json({ ok: true, spinId: spin.id, rewardType: reward.type, rewardValue, caseId, label: resultLabel });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const weightedPick = <T,>(items: Array<{ item: T; weight: number }>) => { const total = items.reduce((s, x) => s + Math.max(0, x.weight), 0); let cursor = Math.random() * total; for (const x of items) { cursor -= Math.max(0, x.weight); if (cursor <= 0) return x.item; } return items[items.length - 1].item; };
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
  const cases = await prisma.case.findMany({ where: { isActive: true, environment: "SYSTEM" }, select: { id: true, slug: true, name: true, image: true, price: true }, orderBy: { price: "asc" } });
  const bonusInventory = await prisma.operation.findMany({ where: { userId: user.id, type: "FORTUNE_DEPOSIT", status: "UNUSED" }, orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ wheel, cases, bonusInventory });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const body = await request.json().catch(() => null) as { idempotencyKey?: unknown } | null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.length > 8 ? body.idempotencyKey : crypto.randomUUID();
  const existing = await prisma.operation.findUnique({ where: { idempotencyKey } });
  if (existing?.type === "FORTUNE_SPIN") return NextResponse.json({ ok: true, ...JSON.parse(existing.label || "{}"), replay: true });

  const reward = weightedPick(wheel.map((item) => ({ item, weight: item.weight })));
  const cases = await prisma.case.findMany({ where: { isActive: true, environment: "SYSTEM" }, select: { id: true, slug: true, name: true, image: true, price: true }, orderBy: { price: "asc" } });
  if (reward.type === "CASE" && !cases.length) return NextResponse.json({ error: "Сейчас нет доступных кейсов." }, { status: 409 });

  let rewardValue: number | null = null, caseId: string | null = null, code: string | null = null, label = reward.label;
  if (reward.type === "DEPOSIT") {
    rewardValue = weightedPick(depositValues.map((value) => ({ item: value, weight: 36 - value })));
    const oldBonus = await prisma.operation.findFirst({ where: { userId: user.id, type: "FORTUNE_DEPOSIT", status: "UNUSED" }, orderBy: { amount: "desc" } });
    if (oldBonus && oldBonus.amount >= rewardValue) {
      const old = JSON.parse(oldBonus.label || "{}");
      label = `Депозит +${oldBonus.amount}%`;
      await prisma.operation.create({ data: { userId: user.id, type: "FORTUNE_SPIN", label: JSON.stringify({ rewardType: reward.type, rewardValue: oldBonus.amount, label }), amount: oldBonus.amount, status: "SUCCESS", idempotencyKey } });
      return NextResponse.json({ ok: true, rewardType: reward.type, rewardValue: oldBonus.amount, label, keptBest: true });
    }
    code = `DEP${rewardValue}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    await prisma.operation.create({ data: { userId: user.id, type: "FORTUNE_DEPOSIT", label: JSON.stringify({ code, percent: rewardValue }), amount: rewardValue, status: "UNUSED", idempotencyKey: `fortune-deposit-${idempotencyKey}` } });
    if (oldBonus) await prisma.operation.update({ where: { id: oldBonus.id }, data: { status: "REPLACED" } });
    label = `Депозит +${rewardValue}%`;
  } else if (reward.type === "CASE") {
    const selected = weightedPick(cases.map((item) => ({ item, weight: 1 / Math.max(1, item.price) })));
    caseId = selected.id; label = `Бесплатный кейс: ${selected.name}`;
    await prisma.freeCaseGrant.create({ data: { userId: user.id, caseId: selected.id } });
  } else if (reward.type === "BALANCE") {
    rewardValue = weightedPick(balanceValues.map((value) => ({ item: value, weight: 56 - value })));
    await prisma.user.update({ where: { id: user.id }, data: { balance: { increment: rewardValue } } });
    await prisma.transaction.create({ data: { userId: user.id, type: "FORTUNE_BALANCE", zCoinAmount: rewardValue, status: "SUCCESS" } });
    label = `Бесплатный баланс: +${rewardValue} Z-Coin`;
  } else {
    rewardValue = reward.label === "Большой Z-Coin" ? 50 : 25;
    await prisma.user.update({ where: { id: user.id }, data: { balance: { increment: rewardValue } } });
    await prisma.transaction.create({ data: { userId: user.id, type: "FORTUNE_ZCOIN", zCoinAmount: rewardValue, status: "SUCCESS" } });
    label = `+${rewardValue} Z-Coin`;
  }
  const result = { rewardType: reward.type, rewardValue, caseId, label, code };
  await prisma.operation.create({ data: { userId: user.id, type: "FORTUNE_SPIN", label: JSON.stringify(result), amount: rewardValue ?? 0, status: "SUCCESS", idempotencyKey } });
  return NextResponse.json({ ok: true, ...result });
}

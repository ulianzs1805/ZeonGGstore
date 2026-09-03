import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
type WheelReward = { type: string; label: string; icon: string; weight: number };
type LetterSlot = "Z" | "E" | "O" | "N" | "G1" | "G2";
type InnerItem = { key: string; title: string; subtitle?: string; image?: string; icon?: string };
const wheel: readonly WheelReward[] = [
  { type: "ZEON_SECRET", label: "ZEONGG Secret", icon: "Z", weight: 10 },
  { type: "DEPOSIT_BONUS", label: "Депозит +5–35%", icon: "%", weight: 12 },
  { type: "FREE_CASE", label: "Бесплатный кейс", icon: "▣", weight: 17 },
  { type: "ZCOIN_RAIN", label: "Z-Coin Rain", icon: "Z¢", weight: 16 },
  { type: "Z_BOOST", label: "+25% к следующей награде", icon: "+25%", weight: 13 },
  { type: "LUCKY_DROP", label: "Lucky Drop", icon: "✦", weight: 11 },
  { type: "SAFE_OPEN", label: "Safe Open", icon: "◉", weight: 9 },
  { type: "DOUBLE_DROP", label: "Double Drop", icon: "2×", weight: 12 },
];
const letterSlots: LetterSlot[] = ["Z", "E", "O", "N", "G1", "G2"];
const depositRewards = [5, 10, 15, 20, 25, 30, 35].map((percent) => ({ amount: percent, label: `+${percent}% к пополнению`, weight: 36 - percent }));
const weightedPick = <T,>(items: Array<{ item: T; weight: number }>) => { const total = items.reduce((s, x) => s + Math.max(0, x.weight), 0); let cursor = Math.random() * total; for (const x of items) { cursor -= Math.max(0, x.weight); if (cursor <= 0) return x.item; } return items[items.length - 1].item; };
const json = (v: unknown) => JSON.stringify(v);
async function getLetterState(userId: string) { const spins = await prisma.operation.findMany({ where: { userId, type: "FORTUNE_SPIN" }, select: { label: true }, orderBy: { createdAt: "desc" }, take: 200 }); const collected = new Set<LetterSlot>(); for (const spin of spins) { try { const data = JSON.parse(spin.label || "{}") as { metadata?: { slotId?: string } }; const slot = data.metadata?.slotId; if (letterSlots.includes(slot as LetterSlot)) collected.add(slot as LetterSlot); } catch {} } const result = letterSlots.filter((slot) => collected.has(slot)); return { collected: result, completed: result.length === letterSlots.length }; }
async function getCases() { return prisma.case.findMany({ where: { isActive: true, environment: "SYSTEM" }, select: { id: true, slug: true, name: true, image: true, price: true }, orderBy: { price: "asc" } }); }
export async function GET() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 }); const cases = await getCases(); return NextResponse.json({ wheel, cases, depositRewards, letterState: await getLetterState(user.id), word: "ZEONGG", letterSlots }); }
export async function POST(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const body = await request.json().catch(() => null) as { idempotencyKey?: unknown } | null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.length > 8 ? body.idempotencyKey : crypto.randomUUID();
  const existing = await prisma.operation.findUnique({ where: { idempotencyKey } });
  if (existing?.type === "FORTUNE_SPIN") return NextResponse.json({ ok: true, ...JSON.parse(existing.label || "{}"), replay: true });
  const cases = await getCases(); const state = await getLetterState(user.id); const eligible = state.completed ? wheel.filter((x) => x.type !== "ZEON_SECRET") : [...wheel]; const reward = weightedPick(eligible.map((item) => ({ item, weight: item.weight }))); const sectorIndex = wheel.findIndex((x) => x.type === reward.type);
  let rewardValue: number | null = null; let caseId: string | null = null; let label = reward.label; let metadata: Record<string, unknown> = { bonusType: reward.type }; let innerRoulette: { items: InnerItem[]; selectedIndex: number; title: string } | null = null;
  if (reward.type === "ZEON_SECRET") {
    const missing = letterSlots.filter((slot) => !state.collected.includes(slot)); if (!missing.length) return NextResponse.json({ error: "ZEONGG уже собрано." }, { status: 409 }); const slotId = weightedPick(missing.map((slot) => ({ item: slot, weight: 1 }))); const next = [...state.collected, slotId]; const completed = letterSlots.every((slot) => next.includes(slot)); const letter = slotId.startsWith("G") ? "G" : slotId; const completionReward = completed ? 50 + Math.floor(Math.random() * 451) : null; innerRoulette = { items: letterSlots.map((slot, i) => ({ key: slot, title: slot.startsWith("G") ? "G" : slot, subtitle: `слот ${i + 1}`, icon: slot.startsWith("G") ? "G" : slot })), selectedIndex: letterSlots.indexOf(slotId), title: "ZEONGG — выбираем букву" }; label = completed ? `ZEONGG собрано! +${completionReward} Z-Coin` : `Буква «${letter}» получена`; rewardValue = completionReward; metadata = { bonusType: reward.type, letter, slotId, word: "ZEONGG", zeonggUnlocked: completed, completionReward };
    if (completed && completionReward) await prisma.$transaction(async (tx) => { await tx.user.update({ where: { id: user.id }, data: { balance: { increment: completionReward } } }); await tx.transaction.create({ data: { userId: user.id, type: "ZCOIN_GRANT", zCoinAmount: completionReward, status: "SUCCESS" } }); await tx.operation.create({ data: { userId: user.id, type: "ZCOIN_GRANT", label: `Награда за сбор слова ZEONGG: ${completionReward} Z-Coin`, amount: completionReward, status: "SUCCESS", idempotencyKey: `zeongg-reward:${idempotencyKey}` } }); await tx.notification.create({ data: { userId: user.id, type: "ZCOIN_GRANT", title: "ZEONGG собрано!", body: `Вам начислено ${completionReward} Z-Coin.` } }); });
  } else if (reward.type === "DEPOSIT_BONUS") {
    const selected = weightedPick(depositRewards.map((item) => ({ item, weight: item.weight }))); innerRoulette = { items: depositRewards.map((item) => ({ key: String(item.amount), title: `+${item.amount}%`, subtitle: "к пополнению", image: "/bonuses/IMG_9364.jpeg" })), selectedIndex: depositRewards.findIndex((item) => item.amount === selected.amount), title: "Бонус на депозит" }; rewardValue = selected.amount; label = `Депозитный бонус: +${selected.amount}%`; metadata = { bonusType: reward.type, percent: selected.amount, onDeposit: true, chanceWeight: selected.weight, image: "/bonuses/IMG_9364.jpeg" };
  } else if (reward.type === "FREE_CASE") {
    if (!cases.length) return NextResponse.json({ error: "Сейчас нет доступных кейсов." }, { status: 409 }); const selected = weightedPick(cases.map((item) => ({ item, weight: 1 / Math.max(1, item.price) }))); caseId = selected.id; label = `Бесплатное открытие: ${selected.name}`; metadata = { bonusType: reward.type, caseId, caseName: selected.name, caseImage: selected.image }; await prisma.freeCaseGrant.create({ data: { userId: user.id, caseId: selected.id } });
  } else if (reward.type === "ZCOIN_RAIN") {
    const pool = [50, 75, 100, 150, 250, 500]; const selected = weightedPick(pool.map((amount) => ({ item: amount, weight: amount >= 500 ? 1 : amount >= 250 ? 2 : 5 }))); rewardValue = selected; innerRoulette = { items: pool.map((amount) => ({ key: String(amount), title: `+${amount} Z-Coin`, icon: "Z¢" })), selectedIndex: pool.indexOf(selected), title: "Z-Coin Rain" }; label = `Z-Coin Rain: +${selected} Z-Coin`; metadata = { bonusType: reward.type, amount: selected };
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { balance: { increment: selected } } });
      await tx.transaction.create({ data: { userId: user.id, type: "ZCOIN_GRANT", zCoinAmount: selected, status: "SUCCESS" } });
      await tx.operation.create({ data: { userId: user.id, type: "ZCOIN_GRANT", label: `Z-Coin Rain: ${selected} Z-Coin`, amount: selected, status: "SUCCESS", idempotencyKey: `fortune-zcoin-grant:${idempotencyKey}` } });
    });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { balance: { increment: selected } } });
      await tx.transaction.create({ data: { userId: user.id, type: "ZCOIN_GRANT", zCoinAmount: selected, status: "SUCCESS" } });
      await tx.operation.create({ data: { userId: user.id, type: "ZCOIN_GRANT", label: `Z-Coin Rain: ${selected} Z-Coin`, amount: selected, status: "SUCCESS", idempotencyKey: `fortune-zcoin-grant:${idempotencyKey}` } });
    });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { balance: { increment: selected } } });
      await tx.transaction.create({ data: { userId: user.id, type: "ZCOIN_GRANT", zCoinAmount: selected, status: "SUCCESS" } });
      await tx.operation.create({ data: { userId: user.id, type: "ZCOIN_GRANT", label: `Z-Coin Rain: ${selected} Z-Coin`, amount: selected, status: "SUCCESS", idempotencyKey: `fortune-zcoin-grant:${idempotencyKey}` } });
    });
    await prisma.$transaction(async (tx) => { await tx.user.update({ where: { id: user.id }, data: { balance: { increment: selected } } }); await tx.transaction.create({ data: { userId: user.id, type: "ZCOIN_GRANT", zCoinAmount: selected, status: "SUCCESS" } }); await tx.operation.create({ data: { userId: user.id, type: "ZCOIN_GRANT", label: `Z-Coin Rain: ${selected} Z-Coin`, amount: selected, status: "SUCCESS", idempotencyKey: `fortune-zcoin-grant:${idempotencyKey}` } }); });
  } else if (reward.type === "Z_BOOST") metadata = { bonusType: reward.type, percent: 25, nextRewardOnly: true };
  else if (reward.type === "LUCKY_DROP") metadata = { bonusType: reward.type, effect: "next_drop_rarity_boost", nextCaseOnly: true };
  else if (reward.type === "SAFE_OPEN") metadata = { bonusType: reward.type, effect: "protect_from_lowest_drop", nextCaseOnly: true };
  else if (reward.type === "DOUBLE_DROP") metadata = { bonusType: reward.type, effect: "additional_random_drop", nextCaseOnly: true };
  const result = { rewardType: reward.type, rewardValue, caseId, label, sectorIndex, metadata, innerRoulette };
  await prisma.operation.create({ data: { userId: user.id, type: "FORTUNE_SPIN", label: json(result), amount: rewardValue ?? 0, status: "SUCCESS", idempotencyKey } });
  await prisma.operation.create({ data: { userId: user.id, type: reward.type === "DEPOSIT_BONUS" ? "FORTUNE_DEPOSIT" : "FORTUNE_BONUS", label: json({ ...metadata, displayLabel: label }), amount: rewardValue ?? 0, status: "UNUSED", idempotencyKey: `fortune-bonus-${idempotencyKey}` } });
  return NextResponse.json({ ok: true, ...result, letterState: await getLetterState(user.id), word: "ZEONGG", letterSlots });
}

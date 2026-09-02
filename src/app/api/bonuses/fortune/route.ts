import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type WheelReward = { type: string; label: string; icon: string; weight: number };
type FortuneMode = "BONUS" | "CASE" | "DEPOSIT";
const weightedPick = <T,>(items: Array<{ item: T; weight: number }>) => {
  const total = items.reduce((s, x) => s + Math.max(0, x.weight), 0);
  let cursor = Math.random() * total;
  for (const x of items) { cursor -= Math.max(0, x.weight); if (cursor <= 0) return x.item; }
  return items[items.length - 1].item;
};

const wheel: readonly WheelReward[] = [
  { type: "ZEON_SECRET", label: "Zeon Secret", icon: "Z", weight: 10 },
  { type: "DEPOSIT_RANDOM_SKIN", label: "Скин за пополнение", icon: "◈", weight: 12 },
  { type: "FREE_CASE", label: "Бесплатный кейс", icon: "▣", weight: 17 },
  { type: "ZCOIN_RAIN", label: "Z-Coin Rain", icon: "Z¢", weight: 16 },
  { type: "Z_BOOST", label: "+25% к следующей награде", icon: "+25%", weight: 13 },
  { type: "LUCKY_DROP", label: "Lucky Drop", icon: "✦", weight: 11 },
  { type: "SAFE_OPEN", label: "Safe Open", icon: "◉", weight: 9 },
  { type: "DOUBLE_DROP", label: "Double Drop", icon: "2×", weight: 12 },
];
const letters = ["Z", "E", "O", "N"] as const;
const depositRewards = [
  { amount: 50, label: "Пополнение от 50 Z-Coin", weight: 18 },
  { amount: 100, label: "Пополнение от 100 Z-Coin", weight: 14 },
  { amount: 250, label: "Пополнение от 250 Z-Coin", weight: 9 },
  { amount: 500, label: "Пополнение от 500 Z-Coin", weight: 5 },
  { amount: 1000, label: "Пополнение от 1000 Z-Coin", weight: 2.5 },
  { amount: 2500, label: "Пополнение от 2500 Z-Coin", weight: 1 },
];
const json = (value: unknown) => JSON.stringify(value);

async function getLetterState(userId: string) {
  const spins = await prisma.operation.findMany({ where: { userId, type: "FORTUNE_SPIN" }, select: { label: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const collected = new Set<string>(); let completed = false;
  for (const spin of spins) {
    if (!spin.label) continue;
    try {
      const data = JSON.parse(spin.label) as { metadata?: { letter?: string; zeonSecretUnlocked?: boolean } };
      const letter = data.metadata?.letter;
      if (typeof letter === "string" && letters.includes(letter as (typeof letters)[number])) collected.add(letter);
      if (data.metadata?.zeonSecretUnlocked) completed = true;
    } catch {}
  }
  return { collected: letters.filter((letter) => collected.has(letter)), completed };
}

async function getCases() {
  return prisma.case.findMany({ where: { isActive: true, environment: "SYSTEM" }, select: { id: true, slug: true, name: true, image: true, price: true }, orderBy: { price: "asc" } });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const cases = await getCases();
  const bonusInventory = await prisma.operation.findMany({ where: { userId: user.id, type: { in: ["FORTUNE_DEPOSIT", "FORTUNE_BONUS"] }, status: "UNUSED" }, orderBy: { createdAt: "desc" }, take: 30 });
  const letterState = await getLetterState(user.id);
  return NextResponse.json({ wheel, cases, depositRewards, bonusInventory, letterState, word: "Zeon" });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { idempotencyKey?: unknown; mode?: unknown } | null;
  const mode: FortuneMode = body?.mode === "CASE" || body?.mode === "DEPOSIT" ? body.mode : "BONUS";
  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.length > 8 ? body.idempotencyKey : crypto.randomUUID();
  const existing = await prisma.operation.findUnique({ where: { idempotencyKey } });
  if (existing?.type === "FORTUNE_SPIN") return NextResponse.json({ ok: true, ...JSON.parse(existing.label || "{}"), replay: true });

  const cases = await getCases();
  let reward: WheelReward = weightedPick(wheel.map((item) => ({ item, weight: item.weight })));
  let sectorIndex = 0;
  let rewardValue: number | null = null;
  let caseId: string | null = null;
  let label = reward.label;
  let metadata: Record<string, unknown> = { bonusType: reward.type, mode };

  if (mode === "CASE") {
    if (!cases.length) return NextResponse.json({ error: "Сейчас нет доступных кейсов." }, { status: 409 });
    const selected = weightedPick(cases.map((item) => ({ item, weight: 1 / Math.max(1, item.price) })));
    reward = { type: "CASE_REWARD", label: selected.name, icon: "▣", weight: 1 };
    sectorIndex = cases.findIndex((item) => item.id === selected.id);
    caseId = selected.id; rewardValue = selected.price;
    label = `Кейс: ${selected.name}`;
    metadata = { bonusType: "CASE_REWARD", mode, caseId, caseName: selected.name, caseImage: selected.image, casePrice: selected.price };
  } else if (mode === "DEPOSIT") {
    const selected = weightedPick(depositRewards.map((item) => ({ item, weight: item.weight })));
    reward = { type: "DEPOSIT_REWARD", label: selected.label, icon: `${selected.amount}`, weight: selected.weight };
    sectorIndex = depositRewards.findIndex((item) => item.amount === selected.amount);
    rewardValue = selected.amount; label = selected.label;
    metadata = { bonusType: "DEPOSIT_REWARD", mode, minimumDeposit: selected.amount, chanceWeight: selected.weight, note: "Чем выше требуемое пополнение, тем ниже его шанс." };
  } else {
    sectorIndex = wheel.findIndex((item) => item.type === reward.type);
    if (reward.type === "FREE_CASE" && !cases.length) return NextResponse.json({ error: "Сейчас нет доступных кейсов." }, { status: 409 });
    if (reward.type === "ZEON_SECRET") {
      const state = await getLetterState(user.id); const missing = letters.filter((letter) => !state.collected.includes(letter));
      const letter = missing.length ? missing[Math.floor(Math.random() * missing.length)] : null; const nextCollected = letter ? [...state.collected, letter] : state.collected;
      const completed = letters.every((item) => nextCollected.includes(item)); metadata = { bonusType: reward.type, mode, letter, word: "Zeon", collectedLetters: nextCollected, zeonSecretUnlocked: completed };
      label = letter ? `Буква «${letter}» для Zeon Secret` : "Zeon Secret уже собран"; if (completed) label = "Zeon Secret открыт — слово Zeon собрано!";
    } else if (reward.type === "DEPOSIT_RANDOM_SKIN") {
      const drops = await prisma.drop.findMany({ where: { environment: "SYSTEM", case: { isActive: true } }, select: { id: true, name: true, rarity: true, image: true, price: true } });
      if (!drops.length) return NextResponse.json({ error: "Сейчас нет доступных скинов." }, { status: 409 });
      const selected = weightedPick(drops.map((item) => ({ item, weight: Math.max(1, 1000 / Math.max(1, item.price)) })));
      metadata = { bonusType: reward.type, mode, skin: selected, onTopUp: true }; label = `Случайный скин за пополнение: ${selected.name}`;
    } else if (reward.type === "FREE_CASE") {
      const selected = weightedPick(cases.map((item) => ({ item, weight: 1 / Math.max(1, item.price) }))); caseId = selected.id;
      metadata = { bonusType: reward.type, mode, caseId, caseName: selected.name, caseImage: selected.image }; label = `Бесплатное открытие: ${selected.name}`;
      await prisma.freeCaseGrant.create({ data: { userId: user.id, caseId: selected.id } });
    } else if (reward.type === "ZCOIN_RAIN") {
      const pool = [50, 75, 100, 150, 250, 500]; rewardValue = weightedPick(pool.map((value) => ({ item: value, weight: value >= 500 ? 1 : value >= 250 ? 2 : 5 }))); metadata = { bonusType: reward.type, mode, amount: rewardValue }; label = `Z-Coin Rain: +${rewardValue} Z-Coin`;
    } else if (reward.type === "Z_BOOST") metadata = { bonusType: reward.type, mode, percent: 25, nextRewardOnly: true };
    else if (reward.type === "LUCKY_DROP") metadata = { bonusType: reward.type, mode, effect: "next_drop_rarity_boost", nextCaseOnly: true };
    else if (reward.type === "SAFE_OPEN") metadata = { bonusType: reward.type, mode, effect: "protect_from_lowest_drop", nextCaseOnly: true };
    else if (reward.type === "DOUBLE_DROP") metadata = { bonusType: reward.type, mode, effect: "additional_random_drop", nextCaseOnly: true };
  }

  const result = { rewardType: reward.type, rewardValue, caseId, label, sectorIndex, mode, metadata };
  await prisma.operation.create({ data: { userId: user.id, type: "FORTUNE_SPIN", label: json(result), amount: rewardValue ?? 0, status: "SUCCESS", idempotencyKey } });
  await prisma.operation.create({ data: { userId: user.id, type: mode === "DEPOSIT" || mode === "CASE" || reward.type === "DEPOSIT_RANDOM_SKIN" ? "FORTUNE_DEPOSIT" : "FORTUNE_BONUS", label: json({ ...metadata, displayLabel: label }), amount: rewardValue ?? 0, status: "UNUSED", idempotencyKey: `fortune-bonus-${idempotencyKey}` } });
  const letterState = await getLetterState(user.id);
  return NextResponse.json({ ok: true, ...result, letterState, word: "Zeon" });
}

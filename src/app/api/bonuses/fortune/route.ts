import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
type WheelReward = { type: string; label: string; icon: string; weight: number };
type LetterSlot = "Z" | "E" | "O" | "N" | "G1" | "G2";
type InnerItem = { key: string; title: string; subtitle?: string; image?: string; icon?: string };

const wheel: readonly WheelReward[] = [
  { type: "ZEON_SECRET", label: "ZEONGG Secret", icon: "Z", weight: 35 },
  { type: "DEPOSIT_BONUS", label: "Депозит +5–35%", icon: "%", weight: 42 },
  { type: "FREE_CASE", label: "Бесплатный кейс", icon: "▣", weight: 13 },
  { type: "ZCOIN_RAIN", label: "Z-Coin Rain", icon: "Z¢", weight: 4 },
  { type: "Z_BOOST", label: "+25% к следующей награде", icon: "+25%", weight: 2 },
  { type: "LUCKY_DROP", label: "Lucky Drop", icon: "✦", weight: 2 },
  { type: "SAFE_OPEN", label: "Safe Open", icon: "◉", weight: 1 },
  { type: "DOUBLE_DROP", label: "Double Drop", icon: "2×", weight: 1 },
];
const letterSlots: LetterSlot[] = ["Z", "E", "O", "N", "G1", "G2"];
const depositRewards = [5, 10, 15, 20, 25, 30, 35].map((percent) => ({ amount: percent, label: `+${percent}% к пополнению`, weight: 36 - percent }));
const weightedPick = <T,>(items: Array<{ item: T; weight: number }>) => {
  const total = items.reduce((sum, x) => sum + Math.max(0, x.weight), 0);
  let cursor = Math.random() * total;
  for (const x of items) {
    cursor -= Math.max(0, x.weight);
    if (cursor <= 0) return x.item;
  }
  return items[items.length - 1].item;
};
const json = (v: unknown) => JSON.stringify(v);
const PROMO_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BYPASS_TYPE = "FORTUNE_BYPASS_CODE";
const BYPASS_USE_TYPE = "FORTUNE_BYPASS_USE";
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const BYPASS_WINDOW_MS = 5 * 60 * 60 * 1000;
const BYPASS_LIMIT = 10;

async function getCooldown(userId: string) {
  const last = await prisma.operation.findFirst({ where: { userId, type: "FORTUNE_SPIN" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (!last) return { available: true, cooldownUntil: null, cooldownRemainingMs: 0 };
  const cooldownUntil = new Date(last.createdAt.getTime() + COOLDOWN_MS);
  const cooldownRemainingMs = Math.max(0, cooldownUntil.getTime() - Date.now());
  return { available: cooldownRemainingMs === 0, cooldownUntil: cooldownRemainingMs ? cooldownUntil.toISOString() : null, cooldownRemainingMs };
}

async function findBypassCode(code: string) {
  const rows = await prisma.operation.findMany({ where: { type: BYPASS_TYPE, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1000, select: { id: true, label: true, createdAt: true } });
  const now = Date.now();
  for (const row of rows) {
    try {
      const data = JSON.parse(row.label || "{}") as { code?: string; expiresAt?: string; oneUsePerAccount?: boolean };
      if (data.code === code && data.expiresAt && new Date(data.expiresAt).getTime() > now) return { row, data };
    } catch {}
  }
  return null;
}

async function consumeBypassCode(userId: string, code: string) {
  const recentUses = await prisma.operation.count({ where: { userId, type: BYPASS_USE_TYPE, createdAt: { gte: new Date(Date.now() - BYPASS_WINDOW_MS) } } });
  if (recentUses >= BYPASS_LIMIT) throw new Error("BYPASS_RATE_LIMIT");
  const found = await findBypassCode(code);
  if (!found) throw new Error("INVALID_BYPASS_CODE");
  const alreadyUsed = await prisma.operation.findFirst({ where: { userId, type: BYPASS_USE_TYPE, label: code }, select: { id: true } });
  if (alreadyUsed) throw new Error("BYPASS_ALREADY_USED");
  await prisma.operation.create({ data: { userId, type: BYPASS_USE_TYPE, label: code, amount: 1, status: "SUCCESS", idempotencyKey: `fortune-bypass-use:${userId}:${found.row.id}` } });
}

async function createUniquePromo(userId: string, percent: number) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = Array.from({ length: 6 }, () => PROMO_ALPHABET[Math.floor(Math.random() * PROMO_ALPHABET.length)]).join("");
    try {
      return await prisma.promoCode.create({
        data: { code, type: "DEPOSIT", depositPercent: percent, ownerId: userId, inventorySaved: false, maxActivations: 1, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdById: userId },
        select: { id: true, code: true, type: true, depositPercent: true, expiresAt: true },
      });
    } catch (error) {
      if (attempt === 9) throw error;
    }
  }
  throw new Error("PROMO_GENERATION_FAILED");
}

async function getLetterState(userId: string) {
  const spins = await prisma.operation.findMany({ where: { userId, type: "FORTUNE_SPIN" }, select: { label: true }, orderBy: { createdAt: "desc" }, take: 200 });
  const collected = new Set<LetterSlot>();
  for (const spin of spins) {
    try { const data = JSON.parse(spin.label || "{}") as { metadata?: { slotId?: string } }; const slot = data.metadata?.slotId; if (letterSlots.includes(slot as LetterSlot)) collected.add(slot as LetterSlot); } catch {}
  }
  const result = letterSlots.filter((slot) => collected.has(slot));
  return { collected: result, completed: result.length === letterSlots.length };
}

async function getCases() {
  return prisma.case.findMany({ where: { isActive: true, environment: "SYSTEM" }, select: { id: true, slug: true, name: true, image: true, price: true }, orderBy: { price: "asc" } });
}

function getFreeCaseRoulette(cases: Awaited<ReturnType<typeof getCases>>) {
  if (!cases.length) return null;
  const sorted = [...cases].sort((a, b) => a.price - b.price);
  const indexes = new Set<number>(); indexes.add(0); indexes.add(Math.floor((sorted.length - 1) / 2)); if (sorted.length > 3) indexes.add(sorted.length - 2); else indexes.add(sorted.length - 1);
  const selected = [...indexes].sort((a, b) => a - b).map((index) => sorted[index]);
  return selected.filter((item, index, arr) => index === arr.findIndex((x) => x.id === item.id)).slice(0, 3);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const cases = await getCases();
  const cooldown = await getCooldown(user.id);
  return NextResponse.json({ wheel, cases, depositRewards, letterState: await getLetterState(user.id), word: "ZEONGG", letterSlots, cooldown, bypass: { limit: BYPASS_LIMIT, windowMs: BYPASS_WINDOW_MS } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const body = await request.json().catch(() => null) as { idempotencyKey?: unknown; bypassCode?: unknown } | null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.length > 8 ? body.idempotencyKey : crypto.randomUUID();
  const bypassCode = typeof body?.bypassCode === "string" ? body.bypassCode.trim().toUpperCase() : "";
  const existing = await prisma.operation.findUnique({ where: { idempotencyKey } });
  if (existing?.type === "FORTUNE_SPIN") return NextResponse.json({ ok: true, ...JSON.parse(existing.label || "{}"), replay: true });

  const cooldown = await getCooldown(user.id);
  if (!cooldown.available) {
    if (!bypassCode) return NextResponse.json({ error: "Барабан доступен снова через 24 часа.", code: "FORTUNE_COOLDOWN", cooldown }, { status: 429 });
    try { await consumeBypassCode(user.id, bypassCode); } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_BYPASS_CODE";
      const messages: Record<string, string> = { INVALID_BYPASS_CODE: "Промокод для обхода лимита недействителен или истёк.", BYPASS_ALREADY_USED: "Этот промокод уже использован на вашем аккаунте.", BYPASS_RATE_LIMIT: "Можно использовать не более 10 таких промокодов за 5 часов." };
      return NextResponse.json({ error: messages[code] ?? "Не удалось применить промокод.", code, cooldown }, { status: 400 });
    }
  } else if (bypassCode) {
    try { await consumeBypassCode(user.id, bypassCode); } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_BYPASS_CODE";
      const messages: Record<string, string> = { INVALID_BYPASS_CODE: "Промокод для обхода лимита недействителен или истёк.", BYPASS_ALREADY_USED: "Этот промокод уже использован на вашем аккаунте.", BYPASS_RATE_LIMIT: "Можно использовать не более 10 таких промокодов за 5 часов." };
      return NextResponse.json({ error: messages[code] ?? "Не удалось применить промокод.", code }, { status: 400 });
    }
  }

  const cases = await getCases();
  const state = await getLetterState(user.id);
  const eligible = state.completed ? wheel.filter((x) => x.type !== "ZEON_SECRET") : [...wheel];
  const reward = weightedPick(eligible.map((item) => ({ item, weight: item.weight })));
  const sectorIndex = wheel.findIndex((x) => x.type === reward.type);
  let rewardValue: number | null = null;
  let caseId: string | null = null;
  let label = reward.label;
  let metadata: Record<string, unknown> = { bonusType: reward.type, bypassUsed: Boolean(bypassCode) };
  let innerRoulette: { items: InnerItem[]; selectedIndex: number; title: string } | null = null;

  if (reward.type === "ZEON_SECRET") {
    const missing = letterSlots.filter((slot) => !state.collected.includes(slot));
    if (!missing.length) return NextResponse.json({ error: "ZEONGG уже собрано." }, { status: 409 });
    const slotId = weightedPick(missing.map((slot) => ({ item: slot, weight: 1 })));
    const next = [...state.collected, slotId]; const completed = letterSlots.every((slot) => next.includes(slot)); const letter = slotId.startsWith("G") ? "G" : slotId; const completionReward = completed ? 50 + Math.floor(Math.random() * 451) : null;
    innerRoulette = { items: letterSlots.map((slot, i) => ({ key: slot, title: slot.startsWith("G") ? "G" : slot, subtitle: `слот ${i + 1}`, icon: slot.startsWith("G") ? "G" : slot })), selectedIndex: letterSlots.indexOf(slotId), title: "ZEONGG — выбираем букву" };
    label = completed ? `ZEONGG собрано! +${completionReward} Z-Coin` : `Буква «${letter}» получена`; rewardValue = completionReward; metadata = { bonusType: reward.type, letter, slotId, word: "ZEONGG", zeonggUnlocked: completed, completionReward, bypassUsed: Boolean(bypassCode) };
    if (completed && completionReward) await prisma.$transaction(async (tx) => { await tx.user.update({ where: { id: user.id }, data: { balance: { increment: completionReward } } }); await tx.transaction.create({ data: { userId: user.id, type: "ZCOIN_GRANT", zCoinAmount: completionReward, status: "SUCCESS" } }); await tx.operation.create({ data: { userId: user.id, type: "ZCOIN_GRANT", label: `Награда за сбор слова ZEONGG: ${completionReward} Z-Coin`, amount: completionReward, status: "SUCCESS", idempotencyKey: `zeongg-reward:${idempotencyKey}` } }); await tx.notification.create({ data: { userId: user.id, type: "ZCOIN_GRANT", title: "ZEONGG собрано!", body: `Вам начислено ${completionReward} Z-Coin.` } }); });
  } else if (reward.type === "DEPOSIT_BONUS") {
    const selected = weightedPick(depositRewards.map((item) => ({ item, weight: item.weight }))); const promo = await createUniquePromo(user.id, selected.amount);
    innerRoulette = { items: depositRewards.map((item) => ({ key: String(item.amount), title: `+${item.amount}%`, subtitle: "к пополнению" })), selectedIndex: depositRewards.findIndex((item) => item.amount === selected.amount), title: "Бонус на депозит" }; rewardValue = selected.amount; label = `Депозитный бонус: +${selected.amount}%`; metadata = { bonusType: reward.type, percent: selected.amount, onDeposit: true, chanceWeight: selected.weight, promoCode: promo.code, promoType: "DEPOSIT", promoExpiresAt: promo.expiresAt.toISOString(), bypassUsed: Boolean(bypassCode) };
  } else if (reward.type === "FREE_CASE") {
    if (!cases.length) return NextResponse.json({ error: "Сейчас нет доступных кейсов." }, { status: 409 }); const rouletteCases = getFreeCaseRoulette(cases); if (!rouletteCases?.length) return NextResponse.json({ error: "Не удалось подготовить бесплатные кейсы." }, { status: 409 }); const selected = weightedPick(rouletteCases.map((item) => ({ item, weight: 1 / Math.max(1, item.price) }))); caseId = selected.id; label = `Бесплатное открытие: ${selected.name}`; innerRoulette = { items: rouletteCases.map((item) => ({ key: item.id, title: item.name, subtitle: `${item.price} Z-Coin`, image: item.image })), selectedIndex: rouletteCases.findIndex((item) => item.id === selected.id), title: "Бесплатный кейс — выбираем кейс" }; metadata = { bonusType: reward.type, caseId, caseName: selected.name, caseImage: selected.image, casePrice: selected.price, freeCaseSelection: "price_weighted", bypassUsed: Boolean(bypassCode) }; await prisma.freeCaseGrant.create({ data: { userId: user.id, caseId: selected.id } });
  } else if (reward.type === "ZCOIN_RAIN") {
    const pool = [50, 75, 100, 150, 250, 500]; const selected = weightedPick(pool.map((amount) => ({ item: amount, weight: amount >= 500 ? 1 : amount >= 250 ? 2 : 5 }))); innerRoulette = { items: pool.map((amount) => ({ key: String(amount), title: `+${amount} Z-Coin`, icon: "Z¢" })), selectedIndex: pool.indexOf(selected), title: "Z-Coin Rain" }; rewardValue = selected; label = `Z-Coin Rain: +${selected} Z-Coin`; metadata = { bonusType: reward.type, amount: selected, bypassUsed: Boolean(bypassCode) }; await prisma.$transaction(async (tx) => { await tx.user.update({ where: { id: user.id }, data: { balance: { increment: selected } } }); await tx.transaction.create({ data: { userId: user.id, type: "ZCOIN_GRANT", zCoinAmount: selected, status: "SUCCESS" } }); await tx.operation.create({ data: { userId: user.id, type: "ZCOIN_GRANT", label: `Z-Coin Rain: ${selected} Z-Coin`, amount: selected, status: "SUCCESS", idempotencyKey: `fortune-zcoin-grant:${idempotencyKey}` } }); });
  } else if (reward.type === "Z_BOOST") metadata = { bonusType: reward.type, percent: 25, nextRewardOnly: true, bypassUsed: Boolean(bypassCode) };
  else if (reward.type === "LUCKY_DROP") metadata = { bonusType: reward.type, effect: "next_drop_rarity_boost", nextCaseOnly: true, bypassUsed: Boolean(bypassCode) };
  else if (reward.type === "SAFE_OPEN") metadata = { bonusType: reward.type, effect: "protect_from_lowest_drop", nextCaseOnly: true, bypassUsed: Boolean(bypassCode) };
  else if (reward.type === "DOUBLE_DROP") metadata = { bonusType: reward.type, effect: "additional_random_drop", nextCaseOnly: true, bypassUsed: Boolean(bypassCode) };

  const result = { rewardType: reward.type, rewardValue, caseId, label, sectorIndex, metadata, innerRoulette };
  await prisma.operation.create({ data: { userId: user.id, type: "FORTUNE_SPIN", label: json(result), amount: rewardValue ?? 0, status: "SUCCESS", idempotencyKey } });
  await prisma.operation.create({ data: { userId: user.id, type: reward.type === "DEPOSIT_BONUS" ? "FORTUNE_DEPOSIT" : "FORTUNE_BONUS", label: json({ ...metadata, displayLabel: label }), amount: rewardValue ?? 0, status: "UNUSED", idempotencyKey: `fortune-bonus-${idempotencyKey}` } });
  return NextResponse.json({ ok: true, ...result, letterState: await getLetterState(user.id), word: "ZEONGG", letterSlots, cooldown: { available: false, cooldownUntil: new Date(Date.now() + COOLDOWN_MS).toISOString(), cooldownRemainingMs: COOLDOWN_MS } });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type WheelReward = {
  type: string;
  label: string;
  icon: string;
  weight: number;
};

const weightedPick = <T,>(items: Array<{ item: T; weight: number }>) => {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= Math.max(0, item.weight);
    if (cursor <= 0) return item.item;
  }
  return items[items.length - 1].item;
};

const depositValues = [5, 10, 15, 20, 25, 30];
const wheel: readonly WheelReward[] = [
  { type: "DEPOSIT_CASE", label: "Кейс за пополнение", icon: "▣", weight: 14 },
  { type: "FREE_SKINS_3_FROM_600", label: "3 случайных скина от 600", icon: "✦", weight: 9 },
  { type: "SKINS_FOR_DEPOSIT", label: "Скин за пополнение", icon: "◈", weight: 10 },
  { type: "LEVEL_1", label: "+1 уровень", icon: "+1", weight: 13 },
  { type: "OPEN_CASE_3_FREE_IN_HOUR", label: "Каждое 3-е открытие бесплатно", icon: "3×", weight: 12 },
  { type: "OPEN_CASE_15_CASH_BACK_IN_HOUR", label: "15% кэшбэк на кейсы", icon: "15%", weight: 12 },
  { type: "FREE_CASE", label: "Бесплатное открытие кейса", icon: "▣", weight: 18 },
  { type: "CONTRACT_SKIN_2", label: "2 предмета для контрактов", icon: "2×", weight: 12 },
];

const json = (value: unknown) => JSON.stringify(value);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const cases = await prisma.case.findMany({
    where: { isActive: true, environment: "SYSTEM" },
    select: { id: true, slug: true, name: true, image: true, price: true },
    orderBy: { price: "asc" },
  });

  const bonusInventory = await prisma.operation.findMany({
    where: { userId: user.id, type: { in: ["FORTUNE_DEPOSIT", "FORTUNE_BONUS"] }, status: "UNUSED" },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ wheel, cases, bonusInventory });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const body = await request.json().catch(() => null) as { idempotencyKey?: unknown } | null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.length > 8
    ? body.idempotencyKey
    : crypto.randomUUID();

  const existing = await prisma.operation.findUnique({ where: { idempotencyKey } });
  if (existing?.type === "FORTUNE_SPIN") {
    return NextResponse.json({ ok: true, ...JSON.parse(existing.label || "{}"), replay: true });
  }

  const reward = weightedPick(wheel.map((item) => ({ item, weight: item.weight })));
  const sectorIndex = wheel.findIndex((item) => item.type === reward.type);

  const cases = await prisma.case.findMany({
    where: { isActive: true, environment: "SYSTEM" },
    select: { id: true, slug: true, name: true, image: true, price: true },
    orderBy: { price: "asc" },
  });

  if ((reward.type === "FREE_CASE" || reward.type === "DEPOSIT_CASE") && !cases.length) {
    return NextResponse.json({ error: "Сейчас нет доступных кейсов." }, { status: 409 });
  }

  let rewardValue: number | null = null;
  let caseId: string | null = null;
  let code: string | null = null;
  let label = reward.label;
  let metadata: Record<string, unknown> = { bonusType: reward.type };

  if (reward.type === "DEPOSIT_CASE") {
    const selected = weightedPick(cases.map((item) => ({ item, weight: 1 / Math.max(1, item.price) })));
    caseId = selected.id;
    metadata = { bonusType: reward.type, caseId, caseName: selected.name, caseImage: selected.image };
    label = `Кейс за пополнение: ${selected.name}`;
  } else if (reward.type === "FREE_SKINS_3_FROM_600") {
    const drops = await prisma.drop.findMany({
      where: { environment: "SYSTEM", case: { isActive: true } },
      select: { id: true, name: true, rarity: true, image: true, price: true },
    });
    if (!drops.length) return NextResponse.json({ error: "Сейчас нет доступных скинов." }, { status: 409 });
    const shuffled = [...drops].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(3, shuffled.length));
    metadata = { bonusType: reward.type, minimumDeposit: 600, skins: selected };
    label = "3 случайных скина при пополнении от 600 Z-Coin";
  } else if (reward.type === "SKINS_FOR_DEPOSIT") {
    const drops = await prisma.drop.findMany({
      where: { environment: "SYSTEM", case: { isActive: true } },
      select: { id: true, name: true, rarity: true, image: true, price: true },
    });
    if (!drops.length) return NextResponse.json({ error: "Сейчас нет доступных скинов." }, { status: 409 });
    const selected = weightedPick(drops.map((item) => ({ item, weight: Math.max(1, 1000 / Math.max(1, item.price)) })));
    metadata = { bonusType: reward.type, skin: selected };
    label = `Скин за пополнение: ${selected.name}`;
  } else if (reward.type === "LEVEL_1") {
    metadata = { bonusType: reward.type, levels: 1 };
    label = "+1 уровень к аккаунту";
  } else if (reward.type === "OPEN_CASE_3_FREE_IN_HOUR") {
    metadata = { bonusType: reward.type, durationMinutes: 60, everyNthOpen: 3 };
    label = "Каждое 3-е открытие кейса бесплатно в течение 1 часа";
  } else if (reward.type === "OPEN_CASE_15_CASH_BACK_IN_HOUR") {
    metadata = { bonusType: reward.type, durationMinutes: 60, cashbackPercent: 15 };
    label = "15% кэшбэк с каждого открытия кейса в течение 1 часа";
  } else if (reward.type === "FREE_CASE") {
    const selected = weightedPick(cases.map((item) => ({ item, weight: 1 / Math.max(1, item.price) })));
    caseId = selected.id;
    metadata = { bonusType: reward.type, caseId, caseName: selected.name, caseImage: selected.image };
    label = `Бесплатное открытие: ${selected.name}`;
    await prisma.freeCaseGrant.create({ data: { userId: user.id, caseId: selected.id } });
  } else if (reward.type === "CONTRACT_SKIN_2") {
    const drops = await prisma.drop.findMany({
      where: { environment: "SYSTEM", case: { isActive: true } },
      select: { id: true, name: true, rarity: true, image: true, price: true },
    });
    if (!drops.length) return NextResponse.json({ error: "Сейчас нет доступных скинов." }, { status: 409 });
    const selected = [...drops].sort(() => Math.random() - 0.5).slice(0, Math.min(2, drops.length));
    metadata = { bonusType: reward.type, skins: selected };
    label = "2 случайных предмета для контрактов";
  }

  const result = {
    rewardType: reward.type,
    rewardValue,
    caseId,
    label,
    code,
    sectorIndex,
    metadata,
  };

  await prisma.operation.create({
    data: {
      userId: user.id,
      type: "FORTUNE_SPIN",
      label: json(result),
      amount: rewardValue ?? 0,
      status: "SUCCESS",
      idempotencyKey,
    },
  });

  await prisma.operation.create({
    data: {
      userId: user.id,
      type: reward.type === "DEPOSIT_CASE" || reward.type === "SKINS_FOR_DEPOSIT" || reward.type === "FREE_SKINS_3_FROM_600" ? "FORTUNE_DEPOSIT" : "FORTUNE_BONUS",
      label: json({ ...metadata, displayLabel: label, code }),
      amount: 0,
      status: "UNUSED",
      idempotencyKey: `fortune-bonus-${idempotencyKey}`,
    },
  });

  return NextResponse.json({ ok: true, ...result });
}

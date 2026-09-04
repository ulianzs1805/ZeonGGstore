import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 5 * 60 * 60 * 1000;
const LIMITS = { ADMIN: { total: 10, CASE: 4, ZCOIN: 6, DEPOSIT: 6, maxZ: 3000 }, DEV: { total: 5, CASE: 2, ZCOIN: 3, DEPOSIT: 3, maxZ: 1500 } } as const;
function canManage(role: string) { return role === "ADMIN" || role === "DEV" || role === "NPN1_DEV"; }
function cleanCode(value: unknown) { return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : ""; }
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  const cases = await prisma.case.findMany({ where: { isActive: true }, select: { id: true, slug: true, name: true }, orderBy: { createdAt: "asc" } });
  const since = new Date(Date.now() - WINDOW_MS);
  const created = user.role === "NPN1_DEV" ? [] : await prisma.promoCode.findMany({ where: { createdById: user.id, createdAt: { gte: since } }, select: { type: true } });
  const limit = user.role === "NPN1_DEV" ? null : LIMITS[user.role as "ADMIN" | "DEV"];
  const usage = { total: created.length, CASE: created.filter((item) => item.type === "CASE").length, ZCOIN: created.filter((item) => item.type === "ZCOIN").length, DEPOSIT: created.filter((item) => item.type === "DEPOSIT").length };
  const promos = await prisma.promoCode.findMany({
    where: { createdById: user.id },
    select: { id: true, code: true, type: true, zCoinAmount: true, depositPercent: true, caseId: true, expiresAt: true, activationCount: true, maxActivations: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ cases, limit, usage, windowHours: 5, promos });
}
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManage(user.role)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const code = cleanCode(body?.code);
  const type = body?.type === "CASE" || body?.type === "ZCOIN" || body?.type === "DEPOSIT" ? body.type : null;
  const maxActivations = Number(body?.maxActivations);
  const expiresAt = new Date(String(body?.expiresAt ?? ""));
  if (code.length < 3 || code.length > 40) return NextResponse.json({ error: "Промокод должен содержать от 3 до 40 символов." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "Выбери тип награды." }, { status: 400 });
  if (!Number.isInteger(maxActivations) || maxActivations < 1 || maxActivations > 1000000) return NextResponse.json({ error: "Укажи корректное количество активаций." }, { status: 400 });
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: "Укажи будущую дату окончания." }, { status: 400 });
  let caseId: string | null = null; let zCoinAmount: number | null = null; let depositPercent: number | null = null;
  if (type === "CASE") { caseId = typeof body?.caseId === "string" ? body.caseId : null; if (!caseId || !await prisma.case.findFirst({ where: { id: caseId, isActive: true }, select: { id: true } })) return NextResponse.json({ error: "Выбери существующий активный кейс." }, { status: 400 }); }
  else if (type === "ZCOIN") { zCoinAmount = Number(body?.zCoinAmount); if (!Number.isInteger(zCoinAmount) || zCoinAmount < 1) return NextResponse.json({ error: "Укажи положительное количество Z-Coin." }, { status: 400 }); }
  else { depositPercent = Number(body?.depositPercent); if (!Number.isInteger(depositPercent) || depositPercent < 1 || depositPercent > 35) return NextResponse.json({ error: "Бонус на депозит должен быть от 1% до 35%." }, { status: 400 }); }
  if (user.role !== "NPN1_DEV") {
    const limit = LIMITS[user.role as "ADMIN" | "DEV"];
    if (type === "ZCOIN" && zCoinAmount! > limit.maxZ) return NextResponse.json({ error: `Максимум для твоей роли: ${limit.maxZ} Z-Coin в одном промокоде.` }, { status: 400 });
    const since = new Date(Date.now() - WINDOW_MS); const created = await prisma.promoCode.findMany({ where: { createdById: user.id, createdAt: { gte: since } }, select: { type: true } }); const typeCount = created.filter((item) => item.type === type).length;
    if (created.length >= limit.total) return NextResponse.json({ error: `Лимит: ${limit.total} промокодов за 5 часов.` }, { status: 429 });
    if (typeCount >= limit[type]) return NextResponse.json({ error: `Лимит ${limit[type]} промокодов типа ${type} за 5 часов.` }, { status: 429 });
  }
  try { const promo = await prisma.promoCode.create({ data: { code, type, zCoinAmount, depositPercent, caseId, maxActivations, expiresAt, createdById: user.id } }); return NextResponse.json({ promo }, { status: 201 }); }
  catch { return NextResponse.json({ error: "Такой промокод уже существует." }, { status: 409 }); }
}

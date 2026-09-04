import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const cleanCode = (value: unknown) => typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = cleanCode(body?.code);
  if (!code) return NextResponse.json({ error: "Введи промокод." }, { status: 400 });

  const promo = await prisma.promoCode.findUnique({ where: { code }, select: { id: true, code: true, type: true, depositPercent: true, ownerId: true, expiresAt: true, activationCount: true, maxActivations: true } });
  if (!promo) return NextResponse.json({ error: "Промокод не найден." }, { status: 404 });
  if (promo.type !== "DEPOSIT") return NextResponse.json({ error: "Этот промокод не предназначен для пополнения." }, { status: 400 });
  if (promo.ownerId && promo.ownerId !== user.id) return NextResponse.json({ error: "Этот промокод принадлежит другому игроку." }, { status: 403 });
  if (promo.expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: "Срок действия промокода истёк." }, { status: 410 });
  if (promo.activationCount >= promo.maxActivations) return NextResponse.json({ error: "Лимит активаций этого промокода исчерпан." }, { status: 409 });

  const alreadyUsed = await prisma.promoActivation.findUnique({ where: { promoId_userId: { promoId: promo.id, userId: user.id } }, select: { id: true } });
  if (alreadyUsed) return NextResponse.json({ error: "Ты уже использовал этот промокод." }, { status: 409 });

  return NextResponse.json({ ok: true, promo: { id: promo.id, code: promo.code, percent: promo.depositPercent ?? 0, expiresAt: promo.expiresAt.toISOString() } });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const cleanCode = (value: unknown) => typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const promos = await prisma.promoCode.findMany({
    where: { ownerId: user.id, inventorySaved: true },
    select: { id: true, code: true, type: true, zCoinAmount: true, depositPercent: true, caseId: true, expiresAt: true, activationCount: true, maxActivations: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ promos });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = cleanCode(body?.code);
  if (!code || code.length !== 6) return NextResponse.json({ error: "Некорректный промокод." }, { status: 400 });

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || promo.ownerId !== user.id) return NextResponse.json({ error: "Промокод не найден." }, { status: 404 });
  if (promo.expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: "Срок действия промокода истёк." }, { status: 410 });

  const saved = await prisma.promoCode.update({
    where: { id: promo.id },
    data: { inventorySaved: true },
    select: { id: true, code: true, type: true, zCoinAmount: true, depositPercent: true, caseId: true, expiresAt: true, activationCount: true, maxActivations: true },
  });

  return NextResponse.json({ ok: true, promo: saved });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const MIN_RUB = 2;
const MAX_RUB = 40000;
const PAYMENT_METHOD = "yoomoney" as const;
const cleanCode = (value: unknown) => typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";
function getBaseUrl(request: Request) { const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL; return (configured || new URL(request.url).origin).replace(/\/$/, ""); }

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });
  const body = await request.json().catch(() => null) as { amount?: unknown; promoCode?: unknown; paymentMethod?: unknown } | null;
  const amount = Number(body?.amount);
  const promoCode = cleanCode(body?.promoCode);
  const paymentMethod = typeof body?.paymentMethod === "string" ? body.paymentMethod : PAYMENT_METHOD;
  if (!Number.isInteger(amount) || amount < MIN_RUB || amount > MAX_RUB) return NextResponse.json({ error: `Сумма пополнения должна быть от ${MIN_RUB} до ${MAX_RUB} ₽.` }, { status: 400 });
  if (paymentMethod !== PAYMENT_METHOD) return NextResponse.json({ error: "Доступен только ЮMoney." }, { status: 400 });

  const idempotencyKey = crypto.randomUUID();
  let promo: { id: string; code: string; depositPercent: number } | null = null;
  if (promoCode) {
    const found = await prisma.promoCode.findUnique({ where: { code: promoCode }, select: { id: true, code: true, type: true, depositPercent: true, ownerId: true, expiresAt: true, activationCount: true, maxActivations: true } });
    if (!found) return NextResponse.json({ error: "Промокод не найден." }, { status: 404 });
    if (found.type !== "DEPOSIT") return NextResponse.json({ error: "Этот промокод не предназначен для пополнения." }, { status: 400 });
    if (found.ownerId && found.ownerId !== user.id) return NextResponse.json({ error: "Этот промокод принадлежит другому игроку." }, { status: 403 });
    if (found.expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: "Срок действия промокода истёк." }, { status: 410 });
    if (found.activationCount >= found.maxActivations) return NextResponse.json({ error: "Лимит активаций этого промокода исчерпан." }, { status: 409 });
    const alreadyUsed = await prisma.promoActivation.findUnique({ where: { promoId_userId: { promoId: found.id, userId: user.id } }, select: { id: true } });
    if (alreadyUsed) return NextResponse.json({ error: "Ты уже использовал этот промокод." }, { status: 409 });
    promo = { id: found.id, code: found.code, depositPercent: found.depositPercent ?? 0 };
  }

  const bonusAmount = Math.floor(amount * (promo?.depositPercent ?? 0) / 100);
  const totalCredit = amount + bonusAmount;
  const transaction = await prisma.transaction.create({ data: { userId: user.id, type: "DEPOSIT", rubAmount: amount, zCoinAmount: totalCredit, status: "PENDING" } });
  try {
    if (!process.env.YOOMONEY_RECEIVER || !process.env.YOOMONEY_HTTP_SECRET) throw new Error("YOOMONEY_NOT_CONFIGURED");
    const metadata = JSON.stringify({ amountRub: amount, bonusAmount, totalCredit, promoId: promo?.id ?? null, promoCode: promo?.code ?? null, promoPercent: promo?.depositPercent ?? 0, paymentMethod, idempotencyKey });
    await prisma.operation.create({ data: { userId: user.id, type: "DEPOSIT_PAYMENT", label: metadata, amount: totalCredit, status: "PENDING", idempotencyKey: `deposit:${transaction.id}` } });
    return NextResponse.json({ ok: true, transactionId: transaction.id, confirmationUrl: `${getBaseUrl(request)}/api/deposit/yoomoney/checkout?id=${encodeURIComponent(transaction.id)}`, amount, bonusAmount, totalCredit });
  } catch (error) {
    await prisma.transaction.update({ where: { id: transaction.id }, data: { status: "CANCELED" } }).catch(() => undefined);
    const message = error instanceof Error && error.message !== "YOOMONEY_NOT_CONFIGURED" ? error.message : "Не удалось создать платёж. Проверь настройки платёжного сервиса и попробуй ещё раз.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

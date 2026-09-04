import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new NextResponse("Missing payment id", { status: 400 });
  const transaction = await prisma.transaction.findUnique({ where: { id }, select: { id: true, rubAmount: true, status: true } });
  const receiver = process.env.YOOMONEY_RECEIVER;
  if (!transaction || transaction.status !== "PENDING" || !transaction.rubAmount || !receiver) return new NextResponse("ЮMoney payment is not configured or transaction is unavailable.", { status: 400 });

  const paymentType = process.env.YOOMONEY_PAYMENT_TYPE === "PC" ? "PC" : "AC";
  const sum = transaction.rubAmount.toFixed(2);
  const label = `ZG:${transaction.id}`;
  const successURL = `${new URL(request.url).origin}/deposit?payment=${encodeURIComponent(transaction.id)}`;
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Оплата — ZeonGGStore</title><style>body{margin:0;background:#05070d;color:#fff;font:600 16px system-ui;display:grid;place-items:center;min-height:100vh}main{max-width:420px;padding:32px;text-align:center;border:1px solid #ffffff18;border-radius:24px;background:#0a0f18}p{color:#94a3b8;line-height:1.5}</style></head><body><main><h2>Переходим к оплате…</h2><p>Сумма: <b>${esc(sum)} ₽</b><br>Сейчас откроется защищённая страница ЮMoney.</p><form id="pay" method="POST" action="https://yoomoney.ru/quickpay/confirm"><input type="hidden" name="receiver" value="${esc(receiver)}"><input type="hidden" name="quickpay-form" value="button"><input type="hidden" name="paymentType" value="${paymentType}"><input type="hidden" name="sum" value="${esc(sum)}"><input type="hidden" name="label" value="${esc(label)}"><input type="hidden" name="successURL" value="${esc(successURL)}"><noscript><button type="submit">Перейти к оплате</button></noscript></form><script>document.getElementById('pay').submit()</script></main></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

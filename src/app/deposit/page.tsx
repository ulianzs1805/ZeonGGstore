"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/app/components/Header";

type PaymentMethod = "sbp" | "bank_card" | "tinkoff_bank" | "sberbank" | "yoomoney";
type Promo = { id: string; code: string; percent: number; expiresAt?: string };
const paymentMethods: Array<{ id: PaymentMethod; title: string; subtitle: string; icon: string }> = [
  { id: "sbp", title: "СБП", subtitle: "Быстрый перевод", icon: "↯" },
  { id: "bank_card", title: "Банковская карта", subtitle: "Мир и другие карты", icon: "▣" },
  { id: "tinkoff_bank", title: "T‑Pay", subtitle: "Оплата в приложении", icon: "T" },
  { id: "sberbank", title: "SberPay", subtitle: "Оплата через Сбер", icon: "S" },
  { id: "yoomoney", title: "ЮMoney", subtitle: "Кошелёк или карта", icon: "Ю" },
];
function DepositContent() {
  const params = useSearchParams();
  const paymentId = params.get("payment");
  const wheelCode = params.get("bonus")?.trim().toUpperCase() ?? "";
  const [amount, setAmount] = useState("100");
  const [promoInput, setPromoInput] = useState(wheelCode);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("sbp");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>(paymentId ? "PENDING" : "");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const value = Math.min(40000, Math.max(0, Number(amount) || 0));
  const bonusAmount = promo ? Math.floor(value * promo.percent / 100) : 0;
  const total = value + bonusAmount;
  const validatePromo = async (code: string) => {
    const clean = code.trim().toUpperCase().replace(/\s+/g, "");
    if (!clean) { setPromo(null); setPromoError(""); return; }
    setPromoError("");
    const response = await fetch("/api/deposit/validate-promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: clean }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setPromo(null); setPromoError(data.error ?? "Промокод недействителен."); return; }
    setPromo(data.promo);
  };
  useEffect(() => { if (wheelCode) void validatePromo(wheelCode); }, [wheelCode]);
  useEffect(() => {
    if (paymentId || wheelCode) return;
    const loadSaved = async () => {
      const response = await fetch("/api/promos/inventory", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const saved = data.promos?.find((item: { type?: string }) => item.type === "DEPOSIT");
      if (saved?.code) { setPromoInput(saved.code); await validatePromo(saved.code); }
    };
    void loadSaved();
  }, [paymentId, wheelCode]);
  useEffect(() => {
    if (!paymentId) return;
    let active = true;
    const poll = async () => {
      const response = await fetch(`/api/deposit/status?id=${encodeURIComponent(paymentId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!active) return;
      setStatus(data.status ?? "PENDING");
      if (data.status === "SUCCESS") setStatusText(`Зачислено ${data.credit} Z-Coin. Баланс обновлён.`);
      else if (data.status === "CANCELED") setStatusText("Платёж отменён или не был завершён.");
      else setStatusText("Проверяем подтверждение платежа…");
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [paymentId]);
  const createPayment = async () => {
    setError("");
    if (value < 50 || value > 40000) { setError("Сумма пополнения — от 50 ₽ до 40 000 ₽."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/deposit/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: value, promoCode: promo?.code ?? promoInput.trim().toUpperCase(), paymentMethod: method }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Не удалось создать платёж.");
      window.location.href = data.confirmationUrl;
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось создать платёж."); setLoading(false); }
  };
  const statusCard = paymentId ? <div className={`mt-5 rounded-2xl border p-4 ${status === "SUCCESS" ? "border-emerald-300/25 bg-emerald-400/10" : status === "CANCELED" ? "border-red-300/20 bg-red-400/10" : "border-violet-300/20 bg-violet-500/10"}`}><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-black/20 text-lg">{status === "SUCCESS" ? "✓" : status === "CANCELED" ? "×" : "…"}</span><div><p className="text-sm font-black">{status === "SUCCESS" ? "Пополнение успешно" : status === "CANCELED" ? "Платёж отменён" : "Платёж обрабатывается"}</p><p className="mt-1 text-xs text-slate-400">{statusText}</p></div></div></div> : null;
  return <main className="min-h-screen bg-[#05070d] text-white"><Header/><section className="px-3 py-5 pb-28 sm:px-6 sm:py-10 lg:px-8"><div className="mx-auto max-w-2xl rounded-[28px] border border-violet-400/20 bg-[#0a0f18]/95 p-4 shadow-[0_0_70px_rgba(124,58,237,.12)] sm:rounded-[30px] sm:p-8">
    <div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.25em] text-violet-300">ZEONGGSTORE</p><h1 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-4xl">Пополнение</h1><p className="mx-auto mt-2 max-w-md text-sm leading-5 text-slate-400">Пополни баланс Z-Coin. После подтверждения платежа средства автоматически зачислятся на аккаунт.</p></div>
    {!paymentId && <>
      <div className="mt-7"><div className="mb-2 flex items-center justify-between"><label className="text-xs font-black uppercase tracking-wide text-slate-400">Способ оплаты</label><span className="text-[10px] font-bold text-slate-600">ЮKassa / ЮMoney</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{paymentMethods.map((item) => <button key={item.id} type="button" onClick={() => setMethod(item.id)} className={`rounded-2xl border p-3 text-left transition active:scale-[.98] ${method === item.id ? "border-violet-300/50 bg-violet-400/10 shadow-[0_0_22px_rgba(168,85,247,.12)]" : "border-white/10 bg-white/[.025] hover:border-white/20"}`}><span className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-black ${method === item.id ? "bg-violet-400/20 text-violet-100" : "bg-white/5 text-slate-300"}`}>{item.icon}</span><span className="mt-2 block text-[11px] font-black text-white">{item.title}</span><span className="mt-0.5 block text-[9px] leading-3 text-slate-500">{item.subtitle}</span></button>)}</div></div>
      <div className="mt-6"><label className="text-xs font-black uppercase tracking-wide text-slate-400">Сумма пополнения</label><div className="mt-2 flex items-center rounded-2xl border border-white/10 bg-black/20 px-4 focus-within:border-violet-400/50"><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))} inputMode="numeric" placeholder="Введите сумму, на которую хотите пополнить" className="min-w-0 flex-1 bg-transparent py-4 text-xl font-black outline-none placeholder:text-sm placeholder:font-medium placeholder:text-white/20 sm:text-2xl"/><span className="font-black text-yellow-300">₽</span></div><p className="mt-2 text-[10px] text-slate-600">Минимум 50 ₽ · максимум 40 000 ₽ · 1 ₽ = 1 Z-Coin</p></div>
      <div className="mt-5"><label className="text-xs font-black uppercase tracking-wide text-slate-400">Введите промокод</label><div className="mt-2 flex gap-2"><input value={promoInput} onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromo(null); setPromoError(""); }} onBlur={() => void validatePromo(promoInput)} onKeyDown={(e) => { if (e.key === "Enter") void validatePromo(promoInput); }} placeholder="Введите депозитный промокод" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm font-black tracking-[.08em] outline-none placeholder:font-medium placeholder:tracking-normal placeholder:text-white/20 focus:border-violet-400/50"/><button type="button" onClick={() => void validatePromo(promoInput)} className="rounded-2xl border border-violet-300/20 bg-violet-400/10 px-4 text-xs font-black text-violet-100 transition active:scale-[.98]">Применить</button></div>{promoError && <p className="mt-2 text-xs text-red-300">{promoError}</p>}{promo && <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2"><span className="font-mono text-xs text-emerald-100">{promo.code}</span><span className="text-xs font-black text-emerald-200">+{promo.percent}%</span></div>}</div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="flex justify-between text-sm text-slate-400"><span>Пополнение</span><span>{value.toLocaleString("ru-RU")} ₽</span></div>{promo && <div className="mt-2 flex justify-between text-sm text-violet-200"><span>Депозитный бонус +{promo.percent}%</span><span>+{bonusAmount.toLocaleString("ru-RU")} Z</span></div>}<div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-black"><span>На баланс</span><span className="text-lg text-white">{total.toLocaleString("ru-RU")} Z</span></div></div>
      {method === "yoomoney" && <p className="mt-3 rounded-xl border border-violet-300/15 bg-violet-400/5 px-4 py-3 text-[10px] leading-4 text-slate-400">ЮMoney откроет отдельную страницу подтверждения оплаты. Зачисление произойдёт только после серверного HTTP-уведомления с проверенной подписью.</p>}
      {error && <p className="mt-4 rounded-xl border border-red-300/15 bg-red-400/10 px-4 py-3 text-xs text-red-100">{error}</p>}
      <button type="button" disabled={loading} onClick={() => void createPayment()} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-4 text-sm font-black uppercase tracking-[.12em] shadow-[0_0_30px_rgba(168,85,247,.3)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">{loading ? "Создаём платёж…" : `Пополнить на ${value.toLocaleString("ru-RU")} ₽`}</button>
    </>}
    {statusCard}
    <div className="mt-5 rounded-2xl border border-white/8 bg-white/[.02] p-4 text-[10px] leading-5 text-slate-500"><b className="text-slate-300">Важно:</b> баланс меняется только после подтверждённого платежа. Историю пополнений можно будет смотреть в разделе операций.</div>
  </div></section></main>;
}
export default function DepositPage() { return <Suspense fallback={<main className="min-h-screen bg-[#05070d] text-white"><Header/><div className="mx-auto max-w-2xl px-4 py-12 text-center text-slate-400">Загрузка пополнения…</div></main>}><DepositContent /></Suspense>; }

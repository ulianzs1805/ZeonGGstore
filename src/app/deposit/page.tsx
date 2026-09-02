"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/app/components/Header";

export default function DepositPage() {
  const params = useSearchParams();
  const [amount, setAmount] = useState("100");
  const [bonus, setBonus] = useState<{ code: string; percent: number } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fromWheel = params.get("bonus");
    if (fromWheel) setBonus({ code: fromWheel, percent: Number(fromWheel.match(/^DEP(\d+)-/)?.[1] || 0) });
    void fetch("/api/bonuses/fortune", { cache: "no-store" }).then(async (r) => { const data = await r.json(); if (!r.ok) return; const best = data.bonusInventory?.[0]; if (!fromWheel && best?.label) { try { const parsed = JSON.parse(best.label); if (parsed.code) setBonus({ code: parsed.code, percent: parsed.percent }); } catch {} } }).catch(() => undefined);
  }, [params]);

  const value = Math.max(0, Number(amount) || 0);
  const bonusAmount = bonus ? Math.floor(value * bonus.percent / 100) : 0;

  return <main className="min-h-screen bg-[#05070d] text-white"><Header/><section className="px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-2xl rounded-[30px] border border-violet-400/20 bg-[#0a0f18]/95 p-5 shadow-[0_0_70px_rgba(124,58,237,.12)] sm:p-8"><p className="text-center text-[10px] font-black uppercase tracking-[.25em] text-violet-300">ZEONGGSTORE</p><h1 className="mt-3 text-center text-4xl font-black tracking-[-.06em]">Пополнение</h1><p className="mx-auto mt-3 max-w-md text-center text-sm text-slate-400">Депозитный бонус из Колеса фортуны подставляется автоматически.</p>
    <label className="mt-8 block text-xs font-black uppercase tracking-wide text-slate-400">Сумма пополнения</label><div className="mt-2 flex items-center rounded-2xl border border-white/10 bg-black/20 px-4"><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="min-w-0 flex-1 bg-transparent py-4 text-2xl font-black outline-none"/><span className="font-black text-yellow-300">Z</span></div>
    <div className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-slate-300">Депозитный бонус</span><span className="text-xl font-black text-violet-200">{bonus ? `+${bonus.percent}%` : "Нет"}</span></div>{bonus ? <><div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-slate-200">{bonus.code}</div><p className="mt-2 text-xs text-slate-500">Бонус сохранён в инвентаре и будет применён к этому пополнению.</p></> : <p className="mt-2 text-xs text-slate-500">Выиграй депозитный бонус в Колесе фортуны.</p>}</div>
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="flex justify-between text-sm text-slate-400"><span>Пополнение</span><span>{value} Z</span></div><div className="mt-2 flex justify-between text-sm text-violet-200"><span>Бонус</span><span>+{bonusAmount} Z</span></div><div className="mt-3 border-t border-white/10 pt-3 flex justify-between font-black"><span>Итого</span><span>{value + bonusAmount} Z</span></div></div>
    <button type="button" onClick={() => setMessage("Сумма и бонус готовы. Платёжный провайдер будет подключён к этой кнопке на следующем этапе.")} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-4 text-sm font-black uppercase tracking-[.12em] shadow-[0_0_30px_rgba(168,85,247,.3)]">Пополнить</button>{message && <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">{message}</p>}</div></section></main>;
}

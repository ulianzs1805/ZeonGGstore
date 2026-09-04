"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";

export default function PromoCodesPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("code");
    if (preset) setCode(preset.toUpperCase().replace(/\s+/g, "").slice(0, 6));
  }, []);

  const activate = async () => {
    const value = code.trim();
    if (!value || busy) { if (!value) setMessage("Введи промокод."); return; }
    setBusy(true); setMessage("Проверяем промокод…");
    try {
      const response = await fetch("/api/promos/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: value }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(typeof data.error === "string" ? data.error : "Не удалось активировать промокод."); return; }
      if (data.kind === "ZCOIN") setMessage(`Промокод активирован! +${data.amount} Z-Coin 🎉`);
      else if (data.kind === "CASE") setMessage("Промокод активирован! Бесплатный кейс уже начислен 🎁");
      else if (data.kind === "DEPOSIT") setMessage(`Промокод активирован! Депозитный бонус +${data.percent}% готов к использованию 🎉`);
      else setMessage("Промокод активирован! 🎉");
      setCode("");
    } catch { setMessage("Ошибка соединения. Попробуй ещё раз."); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#05070d] text-white"><Header /><section className="px-4 pb-12 pt-6"><div className="mx-auto max-w-[1440px] overflow-hidden rounded-[30px] border border-white/10 bg-[#070b11]"><div className="border-b border-white/10 px-4 py-4"><RecentDropsStrip title="Последние дропы" /></div><div className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-16"><Link href="/bonuses" className="text-xs font-black uppercase tracking-[.14em] text-violet-300">← Все бонусы</Link><div className="mt-8 text-center"><p className="text-xs font-semibold uppercase tracking-[.3em] text-violet-300">ZEONGGSTORE • БОНУСЫ</p><h1 className="mt-3 text-4xl font-black uppercase sm:text-5xl">Промокоды</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-400">Введи промокод, полученный для закрытой беты ZeonGGStore.</p></div><div className="mt-9 rounded-[28px] border border-violet-400/20 bg-[#0a0f18] p-5 sm:p-7"><label className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Промокод</label><input value={code} onChange={e => { setCode(e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 6)); setMessage(""); }} onKeyDown={e => { if (e.key === "Enter") void activate(); }} placeholder="ABC123" maxLength={6} disabled={busy} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center text-lg font-black uppercase tracking-[.18em] text-white outline-none placeholder:text-slate-700 focus:border-violet-400/50 disabled:opacity-60" /><button onClick={() => void activate()} disabled={busy || code.length !== 6} className="mt-3 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 text-sm font-black uppercase disabled:cursor-wait disabled:opacity-60">{busy ? "Проверяем…" : "Активировать"}</button>{message && <p className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3 text-center text-xs text-slate-300">{message}</p>}</div></div></div></section></main>;
}

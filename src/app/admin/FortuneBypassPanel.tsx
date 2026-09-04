"use client";

import { useEffect, useState } from "react";

type BypassCode = { id: string; code: string; expiresAt: string; oneUsePerAccount?: boolean; createdAt: string; status: string };

export default function FortuneBypassPanel() {
  const [code, setCode] = useState("");
  const [hours, setHours] = useState("168");
  const [codes, setCodes] = useState<BypassCode[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch("/api/admin/fortune-bypass", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setCodes(Array.isArray(data.codes) ? data.codes : []);
  };

  useEffect(() => { void load(); }, []);

  async function create() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/fortune-bypass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() || undefined, expiresHours: Number(hours) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось создать промокод");
      setCode(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка"); }
    finally { setBusy(false); }
  }

  return <section>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.25em] text-slate-500">Барабан</div><h2 className="mt-1 text-2xl font-black">Промокоды обхода лимита</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">Такой код позволяет одному аккаунту сделать дополнительную прокрутку, даже если 24 часа ещё не прошли. На один аккаунт — максимум 10 использований таких кодов за скользящие 5 часов.</p></div></div>
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.02] p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24))} placeholder="Код (пусто = автоматически)" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 font-mono text-sm text-white outline-none focus:border-violet-400/40" />
        <input value={hours} onChange={(e) => setHours(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Часы" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-400/40" />
        <button type="button" onClick={() => void create()} disabled={busy} className="rounded-xl bg-violet-500 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-400 disabled:opacity-50">{busy ? "Создаём…" : "Создать код"}</button>
      </div>
      <div className="mt-3 text-xs text-slate-500">Код 6–24 символа A-Z/0-9. По умолчанию срок — 168 часов (7 дней). Один код можно использовать один раз на конкретном аккаунте.</div>
      {error && <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</div>}
    </div>
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
      <div className="grid grid-cols-[1fr_auto] border-b border-white/10 bg-white/[.03] px-4 py-3 text-[9px] font-black uppercase tracking-[.16em] text-slate-500"><span>Код</span><span>Истекает</span></div>
      {codes.length === 0 ? <div className="px-4 py-6 text-sm text-slate-500">Промокодов пока нет.</div> : codes.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] items-center border-b border-white/5 px-4 py-3 last:border-0"><span className="font-mono text-sm font-black tracking-[.16em] text-white">{item.code}</span><span className="text-xs text-slate-400">{new Date(item.expiresAt).toLocaleString()}</span></div>)}
    </div>
  </section>;
}

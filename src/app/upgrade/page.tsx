"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const MIN_ITEMS = 3;
const MAX_ITEMS = 10;
const MIN_TOTAL = 15;
const MIN_CHANCE = 0.1;

type Item = { id: string; name: string; rarity: string; image: string; price: number };
type ApiResult = { success: boolean; chance: number; roll: number; target: Item; resultItem: Item | null; inputValue: number; balanceTopUp: number; totalInputValue: number };

const rarityClass: Record<string, string> = {
  COMMON: "text-slate-300", UNCOMMON: "text-cyan-300", RARE: "text-blue-300", EPIC: "text-purple-300", LEGENDARY: "text-pink-300", ARCANE: "text-red-300", NAMELESS: "text-yellow-300",
};
const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
const chanceFor = (input: number, target: number) => Math.max(MIN_CHANCE, Math.min(100, target > 0 ? (input / target) * 100 : MIN_CHANCE));

export default function UpgradePage() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [targets, setTargets] = useState<Item[]>([]);
  const [balance, setBalance] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [targetId, setTargetId] = useState("");
  const [balanceTopUp, setBalanceTopUp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const selectedItems = useMemo(() => selected.map((id) => inventory.find((item) => item.id === id)).filter(Boolean) as Item[], [inventory, selected]);
  const inputValue = useMemo(() => selectedItems.reduce((sum, item) => sum + item.price, 0), [selectedItems]);
  const target = targets.find((item) => item.id === targetId) ?? null;
  const totalInputValue = inputValue + balanceTopUp;
  const chance = target ? chanceFor(totalInputValue, target.price) : MIN_CHANCE;
  const filteredTargets = useMemo(() => { const query = search.trim().toLowerCase(); if (!query) return targets; return targets.filter((item) => item.name.toLowerCase().includes(query) || item.rarity.toLowerCase().includes(query)); }, [targets, search]);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/upgrader", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить апгрейдер");
      setInventory(data.inventory || []); setTargets(data.targets || []); setBalance(Number(data.balance) || 0);
      setBalanceTopUp((current: number) => Math.min(current, Number(data.balance) || 0));
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка загрузки"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  function toggleItem(id: string) { setResult(null); setError(""); setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= MAX_ITEMS ? current : [...current, id]); }

  async function runUpgrade() {
    if (selected.length < MIN_ITEMS || selected.length > MAX_ITEMS || inputValue < MIN_TOTAL || !target || balanceTopUp > balance || submitting) return;
    setSubmitting(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/upgrader", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds: selected, targetId: target.id, balanceTopUp, idempotencyKey: crypto.randomUUID() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Апгрейд не выполнен");
      setResult(data); setSelected([]); setBalance((current) => Math.max(0, current - balanceTopUp)); setBalanceTopUp(0); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка апгрейда"); }
    finally { setSubmitting(false); }
  }

  return (
    <main className="min-h-screen bg-[#05070c] px-3 pb-28 pt-4 text-white sm:px-5 lg:px-8"><div className="mx-auto max-w-[1500px]">
      <header className="mb-5 rounded-[24px] border border-violet-400/20 bg-[#0b0d15] p-5 shadow-[0_0_60px_rgba(124,58,237,.08)] sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.25em] text-violet-300">ZeonGGStore</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-5xl">Апгрейдер</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Собери предметы, выбери цель и при необходимости докинь Z с баланса.</p></div><div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Правила</p><p className="mt-1 text-sm font-bold text-slate-200">3–10 предметов · от 15 Z · минимум 0,1%</p></div></div></header>
      {error && <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-200">{error}</div>}
      {loading ? <div className="rounded-2xl border border-white/10 bg-white/[.02] p-10 text-center text-slate-400">Загружаем инвентарь и цели...</div> : <div className="grid gap-5 xl:grid-cols-[1fr_430px_1fr]">
        <Panel title={`Ваши предметы · ${selected.length}/${MAX_ITEMS}`}><div className="mb-4 flex items-center justify-between gap-3"><span className="text-sm text-slate-400">Выбрано на {money(inputValue)} Z</span><button type="button" onClick={() => setSelected([])} className="text-xs font-black uppercase text-slate-500 hover:text-white">Сбросить</button></div><div className="grid max-h-[680px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">{inventory.map((item) => { const active = selected.includes(item.id); return <button key={item.id} type="button" onClick={() => toggleItem(item.id)} className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${active ? "border-violet-400 bg-violet-500/15 shadow-[0_0_25px_rgba(139,92,246,.18)]" : "border-white/10 bg-black/15 hover:border-white/20"}`}><div className="relative h-28"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="180px" unoptimized /></div><p className={`mt-2 text-[10px] font-black uppercase tracking-widest ${rarityClass[item.rarity] || "text-slate-300"}`}>{item.rarity}</p><p className="mt-1 line-clamp-2 text-xs font-black">{item.name}</p><p className="mt-2 text-sm font-black text-yellow-300">{money(item.price)} Z</p>{active && <span className="absolute right-2 top-2 rounded-full bg-violet-500 px-2 py-1 text-[10px] font-black">✓</span>}</button>; })}</div>{!inventory.length && <div className="py-16 text-center text-sm text-slate-500">В инвентаре нет доступных предметов.</div>}</Panel>
        <Panel title="Результат"><div className="flex min-h-[680px] flex-col"><div className={`relative mx-auto mt-4 flex h-64 w-64 items-center justify-center rounded-full border border-violet-300/30 bg-[radial-gradient(circle,rgba(124,58,237,.25),rgba(7,9,15,.95)_62%)] shadow-[0_0_70px_rgba(124,58,237,.18)] ${submitting ? "animate-spin" : ""}`}><div className="absolute inset-5 rounded-full border border-white/10" /><div className="relative z-10 text-center"><p className="text-[10px] font-black uppercase tracking-[.25em] text-slate-500">Шанс</p><p className="mt-2 text-5xl font-black tabular-nums text-violet-200">{chance.toFixed(chance < 1 ? 2 : 1)}%</p><p className="mt-2 text-xs text-slate-500">{target ? `${money(totalInputValue)} / ${money(target.price)} Z` : "Выберите цель"}</p></div><div className="absolute -right-2 top-1/2 h-10 w-4 -translate-y-1/2 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,.8)]" /></div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between text-sm"><span className="text-slate-400">Сумма предметов</span><b>{money(inputValue)} Z</b></div><div className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-400">Доплата с баланса</span><b className="text-yellow-300">+{money(balanceTopUp)} Z</b></div><div className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-400">Итого для шанса</span><b>{money(totalInputValue)} Z</b></div><div className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-400">Стоимость цели</span><b>{target ? `${money(target.price)} Z` : "—"}</b></div><div className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-400">Шанс успеха</span><b className="text-violet-300">{target ? `${chance.toFixed(chance < 1 ? 2 : 1)}%` : "—"}</b></div></div>
          <div className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-500/[.05] p-4"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-black">Увеличить шанс</span><span className="text-sm font-black text-yellow-300">{money(balanceTopUp)} Z</span></div><input type="range" min="0" max={Math.max(0, balance)} step="1" value={Math.min(balanceTopUp, balance)} onChange={(event) => setBalanceTopUp(Number(event.target.value))} className="w-full accent-violet-500" /><div className="mt-2 flex justify-between text-[10px] font-bold text-slate-500"><span>0 Z</span><span>Баланс: {money(balance)} Z</span></div></div>
          {result && <div className={`mt-4 rounded-2xl border p-4 ${result.success ? "border-emerald-400/20 bg-emerald-500/10" : "border-red-400/20 bg-red-500/10"}`}><p className={`text-xs font-black uppercase tracking-widest ${result.success ? "text-emerald-300" : "text-red-300"}`}>{result.success ? "Апгрейд успешен" : "Апгрейд не удался"}</p><div className="mt-3 flex items-center gap-3">{(result.resultItem || result.target) && <div className="relative h-20 w-20 shrink-0"><Image src={(result.resultItem || result.target).image} alt={(result.resultItem || result.target).name} fill className="object-contain" sizes="80px" unoptimized /></div>}<div><p className="font-black">{(result.resultItem || result.target).name}</p><p className="mt-1 text-xs text-slate-400">Ролл: {result.roll.toFixed(2)} · шанс: {result.chance.toFixed(2)}%</p></div></div></div>}
          <button type="button" onClick={() => void runUpgrade()} disabled={selected.length < MIN_ITEMS || inputValue < MIN_TOTAL || !target || balanceTopUp > balance || submitting} className="mt-auto rounded-2xl bg-violet-600 px-5 py-4 text-sm font-black uppercase tracking-widest shadow-[0_0_35px_rgba(124,58,237,.35)] transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500">{submitting ? "Результат..." : "Сделать апгрейд"}</button>
        </div></Panel>
        <Panel title="Выберите цель"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск предмета..." className="mb-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-violet-400/50" /><div className="grid max-h-[680px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-2">{filteredTargets.map((item) => { const active = item.id === targetId; return <button key={item.id} type="button" onClick={() => { setTargetId(item.id); setResult(null); }} className={`rounded-2xl border p-3 text-left transition ${active ? "border-violet-400 bg-violet-500/15" : "border-white/10 bg-black/15 hover:border-white/20"}`}><div className="relative h-28"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="180px" unoptimized /></div><p className={`mt-2 text-[10px] font-black uppercase tracking-widest ${rarityClass[item.rarity] || "text-slate-300"}`}>{item.rarity}</p><p className="mt-1 line-clamp-2 text-xs font-black">{item.name}</p><p className="mt-2 text-sm font-black text-yellow-300">{money(item.price)} Z</p></button>; })}</div></Panel>
      </div>}
    </div></main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[24px] border border-violet-300/10 bg-[#0b0d15] p-4 shadow-[0_0_45px_rgba(124,58,237,.05)] sm:p-5"><h2 className="mb-4 text-sm font-black uppercase tracking-[.14em] text-slate-200">{title}</h2>{children}</section>; }

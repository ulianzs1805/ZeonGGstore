"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const MIN_ITEMS = 3;
const MAX_ITEMS = 10;
const MIN_TOTAL = 15;
const MIN_CHANCE = 0.1;
const SPIN_MS = 4200;

const money = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);
type Item = { id: string; name: string; rarity: string; image: string; price: number };
type ApiResult = { success: boolean; chance: number; roll: number; target: Item; resultItem: Item | null; inputValue: number; balanceTopUp: number; totalInputValue: number };

const rarityClass: Record<string, string> = {
  COMMON: "text-slate-300", UNCOMMON: "text-cyan-300", RARE: "text-blue-300", EPIC: "text-purple-300", LEGENDARY: "text-pink-300", ARCANE: "text-red-300", NAMELESS: "text-yellow-300",
};
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
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [pendingResult, setPendingResult] = useState<ApiResult | null>(null);
  const [pointerAngle, setPointerAngle] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const selectedItems = useMemo(() => selected.map(id => inventory.find(item => item.id === id)).filter(Boolean) as Item[], [inventory, selected]);
  const inputValue = useMemo(() => selectedItems.reduce((sum, item) => sum + item.price, 0), [selectedItems]);
  const target = targets.find(item => item.id === targetId) ?? null;
  const totalInputValue = inputValue + balanceTopUp;
  const chance = target ? chanceFor(totalInputValue, target.price) : MIN_CHANCE;
  const orangeDegrees = Math.max(0.36, chance * 3.6);

  const filteredTargets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? targets.filter(item => item.name.toLowerCase().includes(q) || item.rarity.toLowerCase().includes(q)) : targets;
  }, [targets, search]);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/upgrader", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить апгрейдер");
      setInventory(data.inventory || []); setTargets(data.targets || []); setBalance(Number(data.balance) || 0);
      setBalanceTopUp(current => Math.min(current, Number(data.balance) || 0));
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка загрузки"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function toggleItem(id: string) {
    setResult(null); setError("");
    setSelected(current => current.includes(id) ? current.filter(v => v !== id) : current.length >= MAX_ITEMS ? current : [...current, id]);
  }

  function getVisualAngle(data: ApiResult) {
    const sector = Math.max(0.36, Math.min(360, data.chance * 3.6));
    const min = data.success ? 1 : sector + 1;
    const max = data.success ? Math.max(1, sector - 1) : 359;
    return min + Math.random() * Math.max(0.01, max - min);
  }

  function startRoulette(data: ApiResult) {
    const landingAngle = getVisualAngle(data);
    const turns = 6;
    const finalAngle = turns * 360 + landingAngle;
    setPendingResult(data);
    setResult(null);
    setSpinning(true);
    setPointerAngle(finalAngle);
    window.setTimeout(() => {
      setPointerAngle(landingAngle);
      setResult(data);
      setPendingResult(null);
      setSpinning(false);
    }, SPIN_MS + 80);
  }

  async function runUpgrade() {
    if (selected.length < MIN_ITEMS || selected.length > MAX_ITEMS || inputValue < MIN_TOTAL || !target || balanceTopUp > balance || submitting || spinning) return;
    setSubmitting(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/upgrader", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds: selected, targetId: target.id, balanceTopUp, idempotencyKey: crypto.randomUUID() }) });
      const data: ApiResult & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Апгрейд не выполнен");
      setSelected([]); setBalance(current => Math.max(0, current - balanceTopUp)); setBalanceTopUp(0);
      startRoulette(data);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка апгрейда"); }
    finally { setSubmitting(false); }
  }

  return (
    <main className="min-h-screen bg-[#04050a] px-3 pb-28 pt-4 text-white sm:px-5 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 rounded-[26px] border border-violet-400/20 bg-[#0b0d15] p-5 shadow-[0_0_70px_rgba(124,58,237,.08)] sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.28em] text-violet-300">ZeonGGStore</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-5xl">Апгрейдер</h1><p className="mt-2 text-sm text-slate-400">Поставь предметы, выбери цель и попробуй забрать более дорогой дроп.</p></div><div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Баланс</p><p className="mt-1 text-lg font-black text-yellow-300">{money(balance)} Z</p></div></div>
        </header>
        {error && <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-200">{error}</div>}
        {loading ? <div className="rounded-2xl border border-white/10 bg-white/[.02] p-10 text-center text-slate-400">Загружаем апгрейдер...</div> : <div className="grid gap-5 lg:grid-cols-[1fr_560px_1fr]">
          <Panel title={`Ваш инвентарь · ${selected.length}/${MAX_ITEMS}`}>
            <div className="mb-4 flex items-center justify-between"><span className="text-sm text-slate-400">Выбрано: <b className="text-white">{money(inputValue)} Z</b></span><button onClick={() => setSelected([])} className="text-xs font-black uppercase text-slate-500 hover:text-white">Сбросить</button></div>
            <div className="grid max-h-[650px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">{inventory.map(item => { const active = selected.includes(item.id); return <button key={item.id} onClick={() => toggleItem(item.id)} className={`relative rounded-2xl border p-3 text-left transition ${active ? "border-violet-400 bg-violet-500/15" : "border-white/10 bg-black/20 hover:border-white/20"}`}><div className="relative h-24"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="160px" unoptimized /></div><p className={`mt-2 text-[9px] font-black uppercase tracking-widest ${rarityClass[item.rarity] || "text-slate-300"}`}>{item.rarity}</p><p className="mt-1 line-clamp-2 text-xs font-black">{item.name}</p><p className="mt-2 text-sm font-black text-yellow-300">{money(item.price)} Z</p>{active && <span className="absolute right-2 top-2 rounded-full bg-violet-500 px-2 py-1 text-[10px] font-black">✓</span>}</button>; })}</div>
            {!inventory.length && <div className="py-16 text-center text-sm text-slate-500">В инвентаре нет доступных предметов.</div>}
          </Panel>

          <Panel title="Рулетка апгрейдера">
            <div className="relative mx-auto aspect-square w-full max-w-[500px] px-3 py-5 sm:px-8">
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,.06)_0,rgba(255,255,255,0)_55%)]" />
              <div className="absolute inset-[7%] rounded-full p-[8px] shadow-[0_0_70px_rgba(124,58,237,.22)]" style={{ background: `conic-gradient(from 0deg, #f97316 0deg ${orangeDegrees}deg, #6d28d9 ${orangeDegrees}deg 360deg)` }}>
                <div className="h-full w-full rounded-full border border-white/10 bg-[#080a12] p-[10%] shadow-[inset_0_0_55px_rgba(0,0,0,.9)]">
                  <div className="relative h-full w-full rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(124,58,237,.12),rgba(4,5,10,.96)_68%)]">
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] font-black uppercase tracking-[.3em] text-slate-500">Шанс</p>
                      <p className="mt-1 text-5xl font-black tracking-tight text-white sm:text-6xl">{chance.toFixed(chance < 1 ? 2 : 1)}%</p>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-orange-300">оранжевый — успех</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-violet-300">фиолетовый — проигрыш</p>
                    </div>
                    {target && <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 sm:h-28 sm:w-28"><Image src={target.image} alt={target.name} fill className="object-contain drop-shadow-[0_0_20px_rgba(255,255,255,.25)]" sizes="112px" unoptimized /></div>}
                  </div>
                </div>
              </div>
              <div className="absolute left-1/2 top-[2%] z-30 h-[96%] w-[6px] -translate-x-1/2" style={{ transform: `translateX(-50%) rotate(${pointerAngle}deg)`, transformOrigin: "50% 50%", transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.08,.72,.12,1)` : "transform 180ms ease-out" }}>
                <div className="absolute left-1/2 top-0 h-11 w-[5px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,.95)] sm:h-14" />
                <div className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[17px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_0_8px_rgba(255,255,255,.8)]" />
              </div>
              <div className="absolute left-1/2 top-1/2 z-40 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#0b0d15] bg-violet-600 shadow-[0_0_35px_rgba(124,58,237,.55)]"><div className="h-3 w-3 rounded-full bg-white shadow-[0_0_12px_white]" /></div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3 text-sm"><Stat label="Предметы" value={`${money(inputValue)} Z`} /><Stat label="Доплата" value={`+${money(balanceTopUp)} Z`} accent /><Stat label="Итого" value={`${money(totalInputValue)} Z`} /><Stat label="Цель" value={target ? `${money(target.price)} Z` : "—"} /></div>
            <div className="mt-4 flex items-end justify-between rounded-2xl border border-white/10 bg-black/20 p-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Цель</p><p className="mt-1 max-w-[260px] truncate text-sm font-black">{target?.name || "Выберите предмет справа"}</p></div>{target && <div className="relative h-16 w-16"><Image src={target.image} alt={target.name} fill className="object-contain" sizes="64px" unoptimized /></div>}</div>
            <div className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-500/[.05] p-4"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-black">Увеличить шанс</span><span className="font-black text-yellow-300">{money(balanceTopUp)} Z</span></div><input type="range" min="0" max={Math.max(0, balance)} step="1" value={Math.min(balanceTopUp, balance)} onChange={e => setBalanceTopUp(Number(e.target.value))} className="w-full accent-violet-500" /><div className="mt-2 flex justify-between text-[10px] font-bold text-slate-500"><span>0 Z</span><span>Доступно {money(balance)} Z</span></div></div>
            {result && <div className={`mt-4 rounded-2xl border p-4 ${result.success ? "border-emerald-400/20 bg-emerald-500/10" : "border-red-400/20 bg-red-500/10"}`}><p className={`text-xs font-black uppercase tracking-widest ${result.success ? "text-emerald-300" : "text-red-300"}`}>{result.success ? "Успешный апгрейд" : "Неудача"}</p><p className="mt-1 text-sm font-bold">{result.success ? result.resultItem?.name : "Предметы сгорели"}</p><p className="mt-1 text-xs text-slate-400">Ролл {result.roll.toFixed(2)} · шанс {result.chance.toFixed(2)}%</p></div>}
            <button onClick={() => void runUpgrade()} disabled={selected.length < MIN_ITEMS || inputValue < MIN_TOTAL || !target || balanceTopUp > balance || submitting || spinning} className="mt-5 w-full rounded-2xl bg-violet-600 px-5 py-4 text-sm font-black uppercase tracking-widest shadow-[0_0_35px_rgba(124,58,237,.35)] transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500">{spinning ? "Рулетка крутится..." : submitting ? "Запускаем..." : "Сделать апгрейд"}</button>
          </Panel>

          <Panel title="Выберите цель">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск предмета..." className="mb-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-violet-400/50" />
            <div className="grid max-h-[650px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-2">{filteredTargets.map(item => { const active = item.id === targetId; return <button key={item.id} onClick={() => { setTargetId(item.id); setResult(null); }} className={`rounded-2xl border p-3 text-left transition ${active ? "border-violet-400 bg-violet-500/15" : "border-white/10 bg-black/20 hover:border-white/20"}`}><div className="relative h-24"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="160px" unoptimized /></div><p className={`mt-2 text-[9px] font-black uppercase tracking-widest ${rarityClass[item.rarity] || "text-slate-300"}`}>{item.rarity}</p><p className="mt-1 line-clamp-2 text-xs font-black">{item.name}</p><p className="mt-2 text-sm font-black text-yellow-300">{money(item.price)} Z</p></button>; })}</div>
          </Panel>
        </div>}
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[24px] border border-violet-300/10 bg-[#0b0d15] p-4 shadow-[0_0_45px_rgba(124,58,237,.05)] sm:p-5"><h2 className="mb-4 text-sm font-black uppercase tracking-[.14em] text-slate-200">{title}</h2>{children}</section>; }
function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p><p className={`mt-1 text-sm font-black ${accent ? "text-yellow-300" : "text-white"}`}>{value}</p></div>; }

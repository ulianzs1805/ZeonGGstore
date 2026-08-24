"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Item = { id: string; name: string; rarity: string; image: string; price: number };
type Result = { success: boolean; chance: number; roll: number; target: Item; resultItem: Item | null; inputItem: Item; inputValue: number; balanceTopUp: number; totalInputValue: number };

const MIN_CHANCE = 0.1;
const SPIN_MS = 4200;
const money = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);
const chanceFor = (input: number, target: number) => Math.max(MIN_CHANCE, Math.min(100, target > 0 ? (input / target) * 100 : MIN_CHANCE));
const rarity: Record<string, string> = { COMMON: "text-slate-300", UNCOMMON: "text-cyan-300", RARE: "text-blue-300", EPIC: "text-purple-300", LEGENDARY: "text-pink-300", ARCANE: "text-red-300", NAMELESS: "text-yellow-300" };

export default function UpgradePage() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [targets, setTargets] = useState<Item[]>([]);
  const [balance, setBalance] = useState(0);
  const [inputId, setInputId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [topUp, setTopUp] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const input = inventory.find((x) => x.id === inputId) || null;
  const target = targets.find((x) => x.id === targetId) || null;
  const inputValue = input?.price || 0;
  const total = inputValue + topUp;
  const chance = target ? chanceFor(total, target.price) : MIN_CHANCE;
  const availableTargets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return targets.filter((x) => !!input && x.price > input.price && (q ? x.name.toLowerCase().includes(q) || x.rarity.toLowerCase().includes(q) : true));
  }, [targets, input, search]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/upgrader", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось загрузить апгрейдер");
      setInventory(d.inventory || []);
      setTargets(d.targets || []);
      setBalance(Number(d.balance) || 0);
      setTopUp((v) => Math.min(v, Number(d.balance) || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function chooseInput(id: string) {
    setInputId(id);
    setTargetId("");
    setResult(null);
    setError("");
  }

  function startRoulette(data: Result) {
    const sector = Math.max(0.36, data.chance * 3.6);
    const landing = data.success
      ? Math.random() * Math.max(0.1, sector - 1) + 0.5
      : sector + 1 + Math.random() * Math.max(0.1, 359 - sector - 1);

    setSpinning(true);
    setAngle((v) => v + 2160 + landing);

    window.setTimeout(() => {
      setResult(data);
      setSpinning(false);
      setBusy(false);
      // Refresh inventory only AFTER the animation/result is visible.
      // This prevents the old implementation from replacing the page while the roulette is spinning.
      void load();
    }, SPIN_MS + 100);
  }

  async function upgrade() {
    if (!input || !target || target.price <= input.price || topUp > balance || busy || spinning) return;

    setBusy(true);
    setError("");
    setResult(null);

    try {
      const r = await fetch("/api/upgrader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: input.id, targetId: target.id, balanceTopUp: topUp, idempotencyKey: crypto.randomUUID() }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Апгрейд не выполнен");

      setBalance((v) => Math.max(0, v - topUp));
      setTopUp(0);
      startRoulette(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка апгрейда");
      setBusy(false);
    }
  }

  const degrees = Math.max(0.36, chance * 3.6);

  return (
    <main className="min-h-screen bg-[#04050a] px-3 pb-28 pt-4 text-white sm:px-5 lg:px-8">
      <div className="mx-auto max-w-[1700px]">
        <header className="mb-5 rounded-[26px] border border-violet-400/20 bg-[#0b0d15] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.28em] text-violet-300">ZeonGGStore</p>
              <h1 className="mt-2 text-3xl font-black sm:text-5xl">Апгрейдер</h1>
              <p className="mt-2 text-sm text-slate-400">Один твой скин → один скин дороже.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Баланс</p>
              <b className="text-lg text-yellow-300">{money(balance)} Z</b>
            </div>
          </div>
        </header>

        {error && <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-200">{error}</div>}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[.02] p-10 text-center text-slate-400">Загружаем апгрейдер...</div>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(270px,330px)_minmax(520px,1fr)_minmax(270px,330px)]">
            {/* LEFT: exactly one input skin */}
            <Panel title="Твой скин">
              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[.06] p-3">
                {input ? (
                  <div className="text-center">
                    <div className="relative mx-auto h-48 w-full"><Image src={input.image} alt={input.name} fill className="object-contain" sizes="300px" unoptimized /></div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${rarity[input.rarity] || "text-slate-300"}`}>{input.rarity}</p>
                    <p className="mt-1 font-black">{input.name}</p>
                    <p className="mt-2 text-lg font-black text-yellow-300">{money(input.price)} Z</p>
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center text-center text-sm text-slate-500">Выбери один скин из инвентаря</div>
                )}
              </div>
              <p className="mb-2 mt-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Инвентарь</p>
              <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1">
                {inventory.map((x) => (
                  <button key={x.id} type="button" onClick={() => chooseInput(x.id)} className={`rounded-xl border p-2 text-left transition ${x.id === inputId ? "border-violet-400 bg-violet-500/15" : "border-white/10 bg-black/20 hover:border-white/20"}`}>
                    <div className="relative h-16"><Image src={x.image} alt={x.name} fill className="object-contain" sizes="90px" unoptimized /></div>
                    <p className="mt-1 truncate text-[9px] font-bold">{x.name}</p>
                    <p className="text-[9px] font-black text-yellow-300">{money(x.price)} Z</p>
                  </button>
                ))}
              </div>
            </Panel>

            {/* CENTER: roulette is the main focus */}
            <Panel title="Рулетка апгрейдера">
              <div className="relative mx-auto aspect-square w-full max-w-[620px] p-4 sm:p-7">
                <div className="absolute inset-[4%] rounded-full p-[9px] shadow-[0_0_90px_rgba(124,58,237,.25)]" style={{ background: `conic-gradient(from 0deg,#f97316 0deg ${degrees}deg,#6d28d9 ${degrees}deg 360deg)` }}>
                  <div className="h-full w-full rounded-full border border-white/10 bg-[#070910] p-[9%]">
                    <div className="relative h-full w-full rounded-full bg-[radial-gradient(circle,rgba(124,58,237,.16),rgba(4,5,10,.97)_68%)]">
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-black uppercase tracking-[.3em] text-slate-500">Шанс успеха</span>
                        <b className="mt-1 text-5xl tabular-nums sm:text-7xl">{chance.toFixed(chance < 1 ? 2 : 1)}%</b>
                        <div className="mt-3 flex gap-3 text-[9px] font-black uppercase tracking-widest">
                          <span className="text-orange-300">● успех</span><span className="text-violet-300">● проигрыш</span>
                        </div>
                        {target && <div className="relative mt-2 h-20 w-20"><Image src={target.image} alt={target.name} fill className="object-contain" sizes="80px" unoptimized /></div>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute left-1/2 top-0 z-30 h-full w-1 -translate-x-1/2" style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 50%", transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.08,.72,.12,1)` : "transform .2s ease-out" }}>
                  <div className="absolute left-1/2 top-0 h-12 w-[5px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_18px_white]" />
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[17px] border-l-transparent border-r-transparent border-t-white" />
                </div>
                <div className="absolute left-1/2 top-1/2 z-40 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#0b0d15] bg-violet-600 shadow-[0_0_35px_rgba(124,58,237,.55)]" />
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Твой скин" value={input ? `${money(input.price)} Z` : "—"} />
                <Stat label="Цель" value={target ? `${money(target.price)} Z` : "—"} />
                <Stat label="Доплата" value={`+${money(topUp)} Z`} />
                <Stat label="Итого" value={`${money(total)} Z`} />
              </div>

              <div className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-500/[.05] p-4">
                <div className="mb-3 flex justify-between"><b>Увеличить шанс</b><b className="text-yellow-300">{money(topUp)} Z</b></div>
                <input type="range" min="0" max={balance} step="1" value={topUp} onChange={(e) => setTopUp(Number(e.target.value))} className="w-full accent-violet-500" disabled={spinning} />
                <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>0 Z</span><span>Доступно {money(balance)} Z</span></div>
              </div>

              {result && (
                <div className={`mt-4 rounded-2xl border p-4 text-center ${result.success ? "border-emerald-400/20 bg-emerald-500/10" : "border-red-400/20 bg-red-500/10"}`}>
                  <p className={`text-xs font-black uppercase tracking-widest ${result.success ? "text-emerald-300" : "text-red-300"}`}>{result.success ? "Успешный апгрейд" : "Апгрейд не удался"}</p>
                  <p className="mt-1 font-black">{result.success ? result.resultItem?.name : `Потерян: ${result.inputItem.name}`}</p>
                </div>
              )}

              <button type="button" onClick={() => void upgrade()} disabled={!input || !target || target.price <= input.price || busy || spinning} className="mt-5 w-full rounded-2xl bg-violet-600 px-5 py-4 font-black uppercase tracking-widest transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500">
                {spinning ? "Рулетка вращается..." : busy ? "Запуск..." : "Сделать апгрейд"}
              </button>
            </Panel>

            {/* RIGHT: exactly one target skin */}
            <Panel title="Цель">
              <div className="rounded-2xl border border-orange-400/20 bg-orange-500/[.05] p-3">
                {target ? (
                  <div className="text-center">
                    <div className="relative mx-auto h-48 w-full"><Image src={target.image} alt={target.name} fill className="object-contain" sizes="300px" unoptimized /></div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${rarity[target.rarity] || "text-slate-300"}`}>{target.rarity}</p>
                    <p className="mt-1 font-black">{target.name}</p>
                    <p className="mt-2 text-lg font-black text-yellow-300">{money(target.price)} Z</p>
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center text-center text-sm text-slate-500">{input ? "Выбери скин дороже своего" : "Сначала выбери свой скин"}</div>
                )}
              </div>
              <p className="mb-2 mt-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Доступные цели</p>
              <input value={search} onChange={(e) => setSearch(e.target.value)} disabled={!input || spinning} placeholder={input ? `Только дороже ${money(input.price)} Z` : "Сначала выбери свой скин"} className="mb-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-violet-400/50 disabled:opacity-50" />
              <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1">
                {availableTargets.map((x) => (
                  <button key={x.id} type="button" onClick={() => { setTargetId(x.id); setResult(null); }} className={`rounded-xl border p-2 text-left transition ${x.id === targetId ? "border-orange-400 bg-orange-500/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}>
                    <div className="relative h-16"><Image src={x.image} alt={x.name} fill className="object-contain" sizes="90px" unoptimized /></div>
                    <p className="mt-1 truncate text-[9px] font-bold">{x.name}</p>
                    <p className="text-[9px] font-black text-yellow-300">{money(x.price)} Z</p>
                  </button>
                ))}
              </div>
              {input && !availableTargets.length && <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-5 text-center"><p className="font-black">Нет доступных скинов</p><p className="mt-1 text-xs text-slate-500">Нет предметов дороже {money(input.price)} Z.</p></div>}
            </Panel>
          </div>
        )}
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[24px] border border-violet-300/10 bg-[#0b0d15] p-4 shadow-[0_0_45px_rgba(124,58,237,.05)] sm:p-5"><h2 className="mb-4 text-sm font-black uppercase tracking-[.14em] text-slate-200">{title}</h2>{children}</section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}

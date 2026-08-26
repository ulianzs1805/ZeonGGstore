"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Item = { id: string; name: string; rarity: string; image: string; price: number };
type Result = {
  success: boolean;
  chance: number;
  roll: number;
  target: Item;
  resultItem: Item | null;
  inputItem: Item;
  inputValue: number;
  balanceTopUp: number;
  totalInputValue: number;
};
type ChanceBand = { label: string; min: number; max: number };
type ResolutionPhase = "idle" | "input-break" | "target-form" | "lose-break";

const MIN_CHANCE = 0.1;
const SPIN_MS = 4200;
const RESULT_MS = 3000;
const INPUT_BREAK_MS = 1000;
const CHANCE_BANDS: ChanceBand[] = [
  { label: "70–79%", min: 70, max: 79.99 },
  { label: "50–59%", min: 50, max: 59.99 },
  { label: "30–39%", min: 30, max: 39.99 },
];
const MULTIPLIERS = [2, 5, 10];
const money = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);
const chanceFor = (input: number, target: number) => Math.max(MIN_CHANCE, Math.min(100, target > 0 ? (input / target) * 100 : MIN_CHANCE));
const rarity: Record<string, string> = {
  COMMON: "text-slate-300", UNCOMMON: "text-cyan-300", RARE: "text-blue-300", EPIC: "text-purple-300",
  LEGENDARY: "text-pink-300", ARCANE: "text-red-300", NAMELESS: "text-yellow-300",
};

export default function UpgradePage() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [targets, setTargets] = useState<Item[]>([]);
  const [balance, setBalance] = useState(0);
  const [inputId, setInputId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [topUp, setTopUp] = useState(0);
  const [search, setSearch] = useState("");
  const [noSkinMode, setNoSkinMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [resolution, setResolution] = useState<ResolutionPhase>("idle");
  const [lockedAttempt, setLockedAttempt] = useState<{ chance: number; topUp: number; target: Item } | null>(null);

  const input = inventory.find((x) => x.id === inputId) || null;
  const inputValue = noSkinMode ? 0 : input?.price || 0;
  const total = noSkinMode ? topUp : inputValue + topUp;
  const target = targets.find((x) => x.id === targetId) || null;
  const chance = target ? chanceFor(total, target.price) : MIN_CHANCE;
  const shownChance = lockedAttempt?.chance ?? chance;
  const shownTarget = lockedAttempt?.target ?? target;
  const isResolving = resolution !== "idle";

  const availableTargets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return targets.filter((x) => total > 0 && x.price > total && (!q || x.name.toLowerCase().includes(q) || x.rarity.toLowerCase().includes(q)));
  }, [targets, total, search]);

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
      return d.inventory || [];
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function snapTopUp(v: number) {
    const max = Math.max(0, Math.floor(balance));
    const n = Math.max(0, Math.min(max, Math.round(v)));
    return n <= 100 ? Math.round(n / 5) * 5 : n <= 500 ? Math.round(n / 10) * 10 : Math.round(n / 25) * 25;
  }

  function chooseInput(id: string) {
    if (spinning || busy || isResolving || noSkinMode) return;
    setInputId(id); setTargetId(""); setResult(null); setError(""); setLockedAttempt(null);
  }
  function toggleNoSkin() {
    if (spinning || busy || isResolving) return;
    setNoSkinMode((v) => !v); setInputId(""); setTargetId(""); setResult(null); setError(""); setLockedAttempt(null);
  }
  function addTopUp(v: number) { setTopUp((current) => snapTopUp(current + v)); }

  function autoTargetForChance(band: ChanceBand) {
    if (total <= 0 || isResolving) return;
    const candidates = targets.filter((x) => x.price > total);
    if (!candidates.length) return;
    const midpoint = (band.min + band.max) / 2;
    const selected = candidates.reduce((best, item) => Math.abs(chanceFor(total, item.price) - midpoint) < Math.abs(chanceFor(total, best.price) - midpoint) ? item : best);
    setTargetId(selected.id); setResult(null); setError("");
  }
  function autoTargetForMultiplier(multiplier: number) {
    if (total <= 0 || isResolving) return;
    const candidates = targets.filter((x) => x.price > total);
    if (!candidates.length) return;
    const desired = total * multiplier;
    const selected = candidates.reduce((best, item) => Math.abs(item.price - desired) < Math.abs(best.price - desired) ? item : best);
    setTargetId(selected.id); setResult(null); setError("");
  }

  function finishResolution(data: Result) {
    window.setTimeout(async () => {
      setResolution("idle");
      const freshInventory = await load();
      if (data.success && data.resultItem) {
        const found = freshInventory.find((x: Item) => x.id === data.resultItem?.id);
        setInputId(found?.id || "");
      } else {
        setInputId("");
      }
      setTargetId("");
      setLockedAttempt(null);
    }, RESULT_MS);
  }

  function startResolution(data: Result) {
    if (data.success) {
      setResolution("input-break");
      window.setTimeout(() => setResolution("target-form"), INPUT_BREAK_MS);
    } else {
      setResolution("lose-break");
    }
    finishResolution(data);
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
      startResolution(data);
    }, SPIN_MS + 100);
  }

  async function upgrade() {
    if ((!input && !noSkinMode) || !target || target.price <= total || topUp > balance || busy || spinning || isResolving || total <= 0) return;
    const attemptTopUp = topUp;
    const attemptChance = chanceFor(total, target.price);
    const attemptTarget = target;
    setLockedAttempt({ chance: attemptChance, topUp: attemptTopUp, target: attemptTarget });
    setBusy(true); setError(""); setResult(null);
    try {
      const r = await fetch("/api/upgrader", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: noSkinMode ? undefined : input?.id, targetId: target.id, balanceTopUp: attemptTopUp, idempotencyKey: crypto.randomUUID() }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Апгрейд не выполнен");
      setBalance((v) => Math.max(0, v - attemptTopUp));
      setTopUp(0);
      startRoulette(d);
    } catch (e) {
      setLockedAttempt(null);
      setError(e instanceof Error ? e.message : "Ошибка апгрейда");
    } finally {
      setBusy(false);
    }
  }

  const degrees = Math.max(0.36, shownChance * 3.6);
  const visualInput = result?.inputItem || (noSkinMode ? null : input);
  const visualTarget = resolution === "target-form" && result?.success ? result.resultItem : shownTarget;

  return (
    <main className="min-h-screen bg-[#04050a] px-2 pb-24 pt-3 text-white sm:px-4 lg:px-6">
      <style jsx global>{`
        @keyframes zeonDissolve { 0%{opacity:1;transform:scale(1);filter:blur(0) brightness(1)} 45%{opacity:.85;transform:scale(1.025);filter:blur(.2px) brightness(1.45)} 100%{opacity:0;transform:scale(.82);filter:blur(6px) brightness(2.1)} }
        @keyframes zeonParticle { 0%{opacity:0;transform:translate(0,0) scale(.3)} 18%{opacity:1} 100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)} }
        @keyframes zeonForm { 0%{opacity:0;transform:scale(.82);filter:blur(9px) brightness(2.4)} 55%{opacity:.9;transform:scale(1.035);filter:blur(1px) brightness(1.55)} 100%{opacity:1;transform:scale(1);filter:blur(0) brightness(1)} }
        .zeon-dissolve{animation:zeonDissolve var(--zeon-duration,1000ms) cubic-bezier(.2,.75,.15,1) forwards;pointer-events:none}
        .zeon-form{animation:zeonForm 2000ms cubic-bezier(.16,.9,.2,1) both}
        .zeon-particle{position:absolute;left:50%;top:50%;width:4px;height:4px;border-radius:999px;background:currentColor;box-shadow:0 0 12px currentColor;animation:zeonParticle var(--zeon-duration,1000ms) cubic-bezier(.1,.7,.2,1) forwards;pointer-events:none}
      `}</style>
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-3 flex items-center justify-between rounded-2xl border border-violet-400/15 bg-[#0b0d15] px-4 py-3">
          <div><p className="text-[9px] font-black uppercase tracking-[.28em] text-violet-300">ZeonGGStore</p><h1 className="text-2xl font-black">Апгрейдер</h1></div>
          <div className="text-right"><p className="text-[8px] uppercase tracking-widest text-slate-500">Баланс</p><b className="text-sm text-yellow-300">{money(balance)} Z</b></div>
        </header>
        {error && <div className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs font-bold text-red-200">{error}</div>}

        {loading ? <div className="rounded-2xl border border-white/10 bg-white/[.02] p-10 text-center text-slate-400">Загружаем апгрейдер...</div> : <>
          <section className="rounded-3xl border border-violet-300/10 bg-[#0b0d15] p-3 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={toggleNoSkin} disabled={spinning || busy || isResolving} className={`rounded-lg border px-3 py-2 text-[9px] font-black uppercase tracking-wider ${noSkinMode ? "border-orange-400/40 bg-orange-500/15 text-orange-300" : "border-white/10 bg-black/20 text-slate-400"}`}>Без скина → за баланс</button>
              <span className="text-[8px] text-slate-600">Цена предмета берётся из каталога ZeonGGStore</span>
            </div>

            <div className="grid grid-cols-[minmax(82px,150px)_minmax(130px,1fr)_minmax(100px,180px)] items-center gap-2 sm:gap-6">
              <SelectedCard item={visualInput} label={noSkinMode ? "БЕЗ СКИНА" : "ТВОЙ СКИН"} compact balanceMode={noSkinMode} dissolve={resolution === "input-break" || resolution === "lose-break"} dissolveMs={resolution === "lose-break" ? RESULT_MS : INPUT_BREAK_MS} />
              <div className="relative mx-auto aspect-square w-full max-w-[390px]">
                <div className="absolute inset-[4%] rounded-full p-[7px] shadow-[0_0_55px_rgba(124,58,237,.2)]" style={{ background: `conic-gradient(from 0deg,#f97316 0deg ${degrees}deg,#6d28d9 ${degrees}deg 360deg)` }}>
                  <div className="h-full w-full rounded-full border border-white/10 bg-[#070910] p-[9%]"><div className="relative h-full w-full rounded-full bg-[radial-gradient(circle,rgba(124,58,237,.15),rgba(4,5,10,.98)_68%)]"><div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-[7px] font-black uppercase tracking-[.25em] text-slate-500 sm:text-[9px]">Шанс</span><b className="text-3xl font-black sm:text-5xl">{shownChance.toFixed(shownChance < 1 ? 2 : 1)}%</b>{shownTarget && <div className="relative mt-1 h-10 w-10 sm:h-16 sm:w-16"><Image src={shownTarget.image} alt={shownTarget.name} fill className="object-contain" sizes="64px" unoptimized /></div>}<span className="mt-1 text-[6px] font-black uppercase tracking-widest text-orange-300">WIN</span><span className="text-[6px] font-black uppercase tracking-widest text-violet-300">LOSE</span></div></div></div>
                </div>
                <div className="absolute left-1/2 top-0 z-30 h-full w-1 -translate-x-1/2" style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 50%", transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.08,.72,.12,1)` : "transform .2s ease-out" }}><div className="absolute left-1/2 top-0 h-7 w-[4px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_14px_white] sm:h-11" /><div className="absolute left-1/2 top-0 -translate-x-1/2 border-l-[7px] border-r-[7px] border-t-[12px] border-l-transparent border-r-transparent border-t-white sm:border-l-[10px] sm:border-r-[10px] sm:border-t-[17px]" /></div>
              </div>
              <SelectedCard item={visualTarget} label="ЦЕЛЕВОЙ СКИН" target dissolve={resolution === "lose-break"} dissolveMs={RESULT_MS} forming={resolution === "target-form" && !!result?.success} hidden={resolution === "input-break" && !!result?.success} />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3"><Stat label="Твой скин / старт" value={noSkinMode ? "Баланс" : input ? `${money(input.price)} Z` : "—"} /><Stat label="Цель" value={target ? `${money(target.price)} Z` : "—"} /><Stat label="Сумма апгрейда" value={`${money(total)} Z`} /></div>
            <div className="mt-3 rounded-xl border border-violet-300/10 bg-violet-500/[.04] p-3">
              <div className="mb-2 flex justify-between text-xs"><b>{noSkinMode ? "Сколько рискуем из баланса" : "Доплата балансом"}</b><b className="text-yellow-300">+{money(topUp)} Z</b></div>
              <input type="range" min="0" max={Math.max(0, Math.floor(balance))} step="1" value={topUp} disabled={spinning || busy || isResolving} onChange={(e) => setTopUp(snapTopUp(Number(e.target.value)))} className="relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-violet-950 [&::-webkit-slider-thumb]:-mt-[6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-violet-500" />
              <div className="pointer-events-none -mt-4 flex justify-between px-2">{Array.from({ length: 21 }, (_, i) => <span key={i} className="h-3 w-px bg-white/35" />)}</div>
              <div className="mt-2 flex justify-between text-[8px] text-slate-500"><span>0 Z</span><span>Доступно {money(balance)} Z</span></div>
              <div className="mt-2 flex gap-2">{[25, 50, 100].filter((v) => v <= balance).map((v) => <button key={v} type="button" disabled={spinning || busy || isResolving} onClick={() => addTopUp(v)} className="rounded bg-violet-500/15 px-2 py-1 text-[9px] font-bold text-violet-300">+{v} Z</button>)}</div>
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3">
              <div className="mb-2 text-[8px] font-black uppercase tracking-[.18em] text-slate-500">Автоподбор цели по реальной цене</div>
              <div className="grid grid-cols-3 gap-2">{CHANCE_BANDS.map((band) => <button key={band.label} type="button" disabled={total <= 0 || spinning || busy || isResolving} onClick={() => autoTargetForChance(band)} className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-2 text-[9px] font-black text-violet-200 disabled:opacity-40">Шанс {band.label}</button>)}</div>
              <div className="mt-2 grid grid-cols-3 gap-2">{MULTIPLIERS.map((m) => <button key={m} type="button" disabled={total <= 0 || spinning || busy || isResolving} onClick={() => autoTargetForMultiplier(m)} className="rounded-lg border border-orange-400/20 bg-orange-500/10 px-2 py-2 text-[9px] font-black text-orange-200 disabled:opacity-40">Цель ×{m}</button>)}</div>
            </div>
            {result && !isResolving && <div className={`mt-3 rounded-xl border p-3 text-center ${result.success ? "border-emerald-400/20 bg-emerald-500/10" : "border-red-400/20 bg-red-500/10"}`}><b className={result.success ? "text-emerald-300" : "text-red-300"}>{result.success ? "УСПЕШНЫЙ АПГРЕЙД" : "АПГРЕЙД НЕ УДАЛСЯ"}</b><p className="mt-1 text-xs">{result.success ? result.resultItem?.name : `Потерян: ${result.inputItem.name}`}</p></div>}
            <button onClick={() => void upgrade()} disabled={(!input && !noSkinMode) || !target || target.price <= total || total <= 0 || busy || spinning || isResolving} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:bg-white/10">{busy || spinning ? "Рулетка..." : isResolving ? "Финализация апгрейда..." : "Сделать апгрейд"}</button>
          </section>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Panel title="ТВОЙ ИНВЕНТАРЬ"><div className="grid max-h-[270px] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-5">{inventory.map((x) => <ItemCard key={x.id} item={x} active={x.id === inputId} disabled={noSkinMode || spinning || isResolving} onClick={() => chooseInput(x.id)} />)}</div>{!inventory.length && <p className="py-8 text-center text-xs text-slate-500">Скинов нет — включи режим «Без скина».</p>}</Panel>
            <Panel title="ДОСТУПНЫЕ ЦЕЛИ"><input value={search} onChange={(e) => setSearch(e.target.value)} disabled={total <= 0 || spinning || isResolving} placeholder={total > 0 ? `Только дороже ${money(total)} Z` : "Сначала выбери стартовую стоимость"} className="mb-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] outline-none placeholder:text-slate-600" /><div className="grid max-h-[238px] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-5">{availableTargets.map((x) => <ItemCard key={x.id} item={x} active={x.id === targetId} disabled={spinning || isResolving} onClick={() => { setTargetId(x.id); setResult(null); }} />)}</div>{total > 0 && !availableTargets.length && <p className="py-8 text-center text-xs text-slate-500">Нет целей дороже {money(total)} Z.</p>}</Panel>
          </div>
        </>}
      </div>
    </main>
  );
}

function ParticleBurst({ duration, color }: { duration: number; color: string }) {
  const particles = Array.from({ length: 22 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 22 + (i % 3) * 0.11;
    const distance = 30 + ((i * 19) % 58);
    return { x: `${Math.cos(angle) * distance}px`, y: `${Math.sin(angle) * distance}px`, delay: `${(i % 5) * 25}ms`, size: 3 + (i % 3) };
  });
  return <div className="absolute inset-0 overflow-hidden text-violet-300">{particles.map((p, i) => <span key={i} className="zeon-particle" style={{ width: p.size, height: p.size, animationDelay: p.delay, color, "--tx": p.x, "--ty": p.y, "--zeon-duration": `${duration}ms` } as React.CSSProperties} />)}</div>;
}

function SelectedCard({ item, label, compact, target, balanceMode, dissolve, dissolveMs = 1000, forming, hidden }: { item: Item | null; label: string; compact?: boolean; target?: boolean; balanceMode?: boolean; dissolve?: boolean; dissolveMs?: number; forming?: boolean; hidden?: boolean }) {
  const cardTone = item ? (target ? "border-orange-400/30 bg-orange-500/[.05]" : "border-violet-400/30 bg-violet-500/[.06]") : "border-dashed border-white/10 bg-black/20";
  return <div className={`text-center transition-opacity duration-300 ${hidden ? "opacity-0" : "opacity-100"}`}><p className="mb-1 text-[7px] font-black uppercase tracking-widest text-slate-500 sm:text-[9px]">{label}</p><div className={`relative mx-auto overflow-hidden rounded-xl border ${cardTone} ${compact ? "h-24 w-full sm:h-32" : "h-28 w-full sm:h-40"}`}><span className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-600">{!item && (balanceMode ? "Z-Coin" : "Выбери")}</span>{item && <div className={`relative h-full w-full ${dissolve ? "zeon-dissolve" : ""} ${forming ? "zeon-form" : ""}`} style={{ "--zeon-duration": `${dissolveMs}ms` } as React.CSSProperties}><Image src={item.image} alt={item.name} fill className="object-contain p-2" sizes="180px" unoptimized /></div>}{dissolve && <ParticleBurst duration={dissolveMs} color={target ? "#fb923c" : "#a78bfa"} />}</div>{item && <div className={`${dissolve ? "zeon-dissolve" : ""} ${forming ? "zeon-form" : ""}`} style={{ "--zeon-duration": `${dissolveMs}ms` } as React.CSSProperties}><p className="mt-1 line-clamp-1 text-[9px] font-black sm:text-xs">{item.name}</p><p className="text-[9px] font-black text-yellow-300 sm:text-xs">{money(item.price)} Z</p></div>}</div>;
}
function ItemCard({ item, active, onClick, disabled }: { item: Item; active: boolean; onClick: () => void; disabled?: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-lg border p-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-violet-400 bg-violet-500/15" : "border-white/10 bg-black/20 hover:border-white/20"}`}><div className="relative h-14 sm:h-20"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="100px" unoptimized /></div><p className={`line-clamp-1 text-[7px] font-black uppercase ${rarity[item.rarity] || "text-slate-300"}`}>{item.rarity}</p><p className="mt-0.5 line-clamp-1 text-[8px] font-bold">{item.name}</p><p className="text-[8px] font-black text-yellow-300">{money(item.price)} Z</p></button>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-violet-300/10 bg-[#0b0d15] p-3"><h2 className="mb-2 text-[9px] font-black uppercase tracking-[.16em] text-slate-300">{title}</h2>{children}</section>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-white/10 bg-black/20 p-2"><p className="text-[7px] uppercase tracking-widest text-slate-500">{label}</p><p className="text-[10px] font-black sm:text-xs">{value}</p></div>; }

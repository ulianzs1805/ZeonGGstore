"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Item = { id: string; name: string; rarity: string; image: string; price: number };
type Result = {
  success: boolean;
  chance: number;
  roll: number;
  target: Item;
  resultItem: Item | null;
  inputItem: Item | null;
  inputValue: number;
  balanceTopUp: number;
  totalInputValue: number;
};
type Attempt = { input: Item | null; target: Item; chance: number };
type Phase = "idle" | "burst" | "gather";
type Particle = { id: number; x: number; y: number; rotate: number; delay: number };

const SPIN_MS = 4200;
const BURST_MS = 2200;
const GATHER_MS = 2200;
const BREAK_MS = BURST_MS + GATHER_MS;
const MIN_CHANCE = 25;
const money = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);
const chanceFor = (input: number, target: number) => Math.max(MIN_CHANCE, Math.min(100, target > 0 ? (input / target) * 100 : MIN_CHANCE));

function makeParticles(seed: number): Particle[] {
  const next = (n: number) => {
    const x = Math.sin(n * 981.73 + seed * 0.00021) * 10000;
    return x - Math.floor(x);
  };

  return [0, 1, 2, 3].map((id) => ({
    id,
    x: (next(id * 9 + 1) - 0.5) * 140,
    y: (next(id * 9 + 2) - 0.5) * 120,
    rotate: (next(id * 9 + 3) - 0.5) * 80,
    delay: Math.round(next(id * 9 + 4) * 110),
  }));
}

function preloadImage(src?: string | null) {
  if (!src || typeof window === "undefined") return;
  const image = new window.Image();
  image.decoding = "async";
  image.src = src;
}

export default function UpgradePage() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [targets, setTargets] = useState<Item[]>([]);
  const [balance, setBalance] = useState(0);
  const [inputId, setInputId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [topUp, setTopUp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [animating, setAnimating] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [optimisticInput, setOptimisticInput] = useState<Item | null>(null);

  const inventoryInput = inventory.find((item) => item.id === inputId) || null;
  const input = optimisticInput && inputId === optimisticInput.id ? optimisticInput : inventoryInput;
  const target = targets.find((item) => item.id === targetId) || null;
  const total = (input?.price || 0) + topUp;
  const chance = target && total > 0 ? chanceFor(total, target.price) : MIN_CHANCE;
  const shownChance = attempt?.chance ?? chance;
  const winDegrees = Math.max(90, Math.min(360, shownChance * 3.6));
  const displayInput = attempt?.input ?? input;
  const displayTarget = attempt?.target ?? target;

  async function load() {
    const response = await fetch("/api/upgrader", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Не удалось загрузить апгрейдер");

    const nextInventory = Array.isArray(data.inventory) ? data.inventory : [];
    setInventory(nextInventory);
    setTargets(Array.isArray(data.targets) ? data.targets : []);
    setBalance(Number(data.balance) || 0);
    return nextInventory as Item[];
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки")).finally(() => setLoading(false));
  }, []);

  function chooseInput(id: string) {
    if (busy || spinning || animating) return;
    setOptimisticInput(null);
    setInputId((current) => current === id ? "" : id);
    setTopUp(0);
    setError("");
    setResult(null);
  }

  function chooseTarget(id: string) {
    if (busy || spinning || animating) return;
    setTargetId(id);
    setError("");
    setResult(null);
  }

  function setChancePreset(percent: number) {
    if (!target || busy || spinning || animating) return;
    const wanted = target.price * (percent / 100);
    setTopUp(Math.round(Math.max(0, Math.min(balance, wanted - (input?.price || 0))) * 100) / 100);
  }

  function chooseMultiplier(multiplier: number) {
    if (total <= 0 || busy || spinning || animating) return;
    const desired = total * multiplier;
    const candidates = targets.filter((item) => item.price > total);
    const closest = candidates.reduce<Item | null>((best, item) => !best || Math.abs(item.price - desired) < Math.abs(best.price - desired) ? item : best, null);
    if (closest) setTargetId(closest.id);
  }

  function startRoulette(data: Result) {
    if (data.success) preloadImage(data.resultItem?.image || data.target.image);

    const sector = Math.max(90, Math.min(359.64, data.chance * 3.6));
    const margin = Math.min(7, Math.max(2.5, sector * 0.04, (360 - sector) * 0.04));
    const winMin = margin;
    const winMax = Math.max(winMin + 0.01, sector - margin);
    const loseMin = Math.min(359.5, sector + margin);
    const loseMax = Math.max(loseMin + 0.01, 360 - margin);
    const landing = data.success ? winMin + Math.random() * (winMax - winMin) : loseMin + Math.random() * (loseMax - loseMin);

    setAngle((current) => {
      const norm = ((current % 360) + 360) % 360;
      return current + 2160 + ((landing - norm + 360) % 360);
    });

    setSpinning(true);
    window.setTimeout(() => {
      setSpinning(false);
      void playResult(data);
    }, SPIN_MS + 100);
  }

  async function playResult(data: Result) {
    setResult(data);
    setParticles(makeParticles(Date.now()));
    setPhase("burst");
    setAnimating(true);

    if (data.success) {
      window.setTimeout(() => setPhase("gather"), BURST_MS);
    }

    window.setTimeout(() => {
      if (data.success && data.resultItem) {
        const won = data.resultItem;
        setOptimisticInput(won);
        setInventory((current) => {
          const oldId = data.inputItem?.id || attempt?.input?.id;
          return [won, ...current.filter((item) => item.id !== oldId && item.id !== won.id && item.name.toLowerCase() !== won.name.toLowerCase())];
        });
        setInputId(won.id);
        setTargetId("");
        setTopUp(0);
        setAttempt(null);
        setParticles([]);
        setPhase("idle");
        setAnimating(false);

        void load().then((fresh) => {
          const serverWinner = fresh.find((item) => item.id === won.id) || fresh.find((item) => item.name.toLowerCase() === won.name.toLowerCase());
          if (serverWinner) {
            setOptimisticInput(serverWinner);
            setInputId(serverWinner.id);
          }
        }).catch((e) => setError(e instanceof Error ? e.message : "Ошибка синхронизации инвентаря"));
      } else {
        const oldId = data.inputItem?.id || attempt?.input?.id;
        if (oldId) setInventory((current) => current.filter((item) => item.id !== oldId));
        setOptimisticInput(null);
        setInputId("");
        setTargetId("");
        setTopUp(0);
        setAttempt(null);
        setParticles([]);
        setPhase("idle");
        setAnimating(false);
        void load().catch((e) => setError(e instanceof Error ? e.message : "Ошибка синхронизации инвентаря"));
      }
    }, data.success ? BREAK_MS : BURST_MS);
  }

  async function upgrade() {
    if (!target || total <= 0 || target.price <= total || topUp > balance || busy || spinning || animating) return;

    setBusy(true);
    setError("");
    setResult(null);
    setAttempt({ input, target, chance });

    try {
      const response = await fetch("/api/upgrader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: input?.id || "",
          targetId: target.id,
          balanceTopUp: topUp,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Апгрейд не выполнен");
      setBalance((value) => Math.max(0, value - topUp));
      startRoulette(data);
    } catch (e) {
      setAttempt(null);
      setError(e instanceof Error ? e.message : "Ошибка апгрейда");
    } finally {
      setBusy(false);
    }
  }

  const availableTargets = useMemo(() => {
    const seen = new Set<string>();
    return targets.filter((item) => {
      const key = item.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return total > 0 ? item.price > total : true;
    });
  }, [targets, total]);

  const leftFragments = animating && result ? displayInput : null;
  const rightFragments = animating && result ? displayTarget : null;
  const winningItem = result?.success ? result.resultItem || displayTarget : null;

  if (loading) {
    return <main className="min-h-screen bg-[#090b16] p-8 text-center text-zinc-400">Загружаем апгрейдер...</main>;
  }

  return <main className="min-h-screen bg-[#090b16] pb-24 text-white">
    <div className="mx-auto max-w-[1280px] overflow-hidden">
      <section className="relative overflow-hidden border-y border-violet-400/10 bg-[radial-gradient(circle_at_50%_34%,rgba(110,49,255,.20),transparent_30%),radial-gradient(circle_at_20%_25%,rgba(255,119,34,.09),transparent_28%),linear-gradient(180deg,#0d1020_0%,#090b16_82%)] px-4 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(120deg,transparent,rgba(115,53,255,.05),transparent)]" />
        <div className="relative mb-6 flex items-center justify-between gap-4 rounded-2xl border border-violet-400/10 bg-[#0e1120]/90 px-5 py-4 shadow-[0_16px_60px_rgba(0,0,0,.22)]">
          <div><p className="text-[9px] font-black tracking-[.34em] text-violet-300">ZEONGGSTORE</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Апгрейдер</h1></div>
          <div className="text-right"><p className="text-[8px] font-black tracking-[.22em] text-zinc-500">БАЛАНС</p><p className="mt-1 font-black text-[#f2b84d]">{money(balance)} Z</p></div>
        </div>

        <div className="relative grid min-h-[300px] grid-cols-[.9fr_1.25fr_.9fr] items-center gap-2 sm:min-h-[470px] sm:gap-8">
          <UpgradeFragmentLayer leftItem={leftFragments} rightItem={rightFragments} winningItem={winningItem} phase={phase} particles={particles} />
          <WeaponSlot item={displayInput} side="left" onShuffle={() => { setOptimisticInput(null); setInputId(""); }} imageHidden={animating} />

          <div className="relative z-10 mx-auto flex w-full max-w-[460px] flex-col items-center">
            <div className="relative h-[250px] w-[250px] sm:h-[390px] sm:w-[390px]">
              <div className="absolute inset-[7%] rounded-full border-[8px] border-[#261a4b] bg-[#0b0d18] shadow-[0_0_42px_rgba(111,51,255,.22)]" style={{ background: `conic-gradient(from 0deg,#ff8a2a 0deg ${winDegrees}deg,#7a3cf2 ${winDegrees}deg 360deg)` }}>
                <div className="absolute inset-[8px] rounded-full bg-[#0d0f1c] shadow-[inset_0_0_38px_rgba(0,0,0,.48)]">
                  <div className="absolute inset-x-0 top-[18%] text-center text-[9px] font-black tracking-[.25em] text-[#b8a5ff]">ШАНС</div>
                  <div className="absolute inset-x-0 top-[31%] text-center text-4xl font-black sm:text-6xl">{shownChance.toFixed(1)}%</div>
                  <div className="absolute inset-x-0 bottom-[17%] text-center text-[9px] font-black tracking-[.24em] text-zinc-500">WIN / LOSE</div>
                </div>
                <div className="absolute left-1/2 top-[-10px] z-30 h-[calc(100%+20px)] w-1 -translate-x-1/2" style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 50%", transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.08,.72,.12,1)` : "transform .25s ease-out" }}>
                  <div className="absolute left-1/2 top-0 h-12 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,.8)]" />
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[.42em] text-violet-300/55">ZeonGG Upgrade</p>
          </div>

          <WeaponSlot item={displayTarget} side="right" onShuffle={() => setTargetId("")} imageHidden={animating} />
        </div>

        <div className="relative z-20 mx-auto mt-7 max-w-5xl rounded-[24px] border border-violet-400/10 bg-[#0e1120]/70 p-4 shadow-[0_22px_80px_rgba(0,0,0,.18)] sm:p-6">
          <div className="mb-3 flex items-center justify-between text-sm font-black text-zinc-300 sm:text-lg"><span>Добавить баланс</span><span className="text-[#f2b84d]">{money(topUp)} Z</span></div>
          <div className="rounded-2xl border border-white/5 bg-[#151827] px-4 py-4"><input type="range" min="0" max={Math.max(0, Math.floor(balance * 100) / 100)} step="0.01" value={topUp} onChange={(e) => setTopUp(Math.max(0, Math.min(balance, Number(e.target.value))))} disabled={spinning || busy || animating} className="h-3 w-full accent-[#7b46ff]" /></div>
          <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-2xl border border-violet-400/10 bg-[#121525] text-xs font-black sm:text-sm">
            <button type="button" onClick={() => setTopUp(0)} className="min-h-14 border-r border-violet-400/10 text-[#ff9b43]">ϟ</button>
            {[30, 50, 70].map((percent) => <button key={percent} type="button" onClick={() => setChancePreset(percent)} className="min-h-14 border-r border-violet-400/10 transition hover:bg-violet-500/10">{percent}%</button>)}
            {[2, 5, 10].map((multiplier) => <button key={multiplier} type="button" onClick={() => chooseMultiplier(multiplier)} className="min-h-14 border-r border-violet-400/10 last:border-r-0 transition hover:bg-orange-400/10">X{multiplier}</button>)}
          </div>
          <button type="button" onClick={() => void upgrade()} disabled={!target || total <= 0 || target.price <= total || topUp > balance || busy || spinning || animating} className="mt-5 w-full rounded-2xl bg-[linear-gradient(90deg,#6730df,#9138f5,#ff7f2a)] py-5 text-base font-black tracking-[.16em] text-white shadow-[0_14px_40px_rgba(105,52,255,.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">{animating ? "АНИМАЦИЯ..." : spinning ? "АПГРЕЙД ИДЁТ..." : busy ? "ОБРАБОТКА..." : "СДЕЛАТЬ АПГРЕЙД"}</button>
          {result && !animating && <div className={`mt-4 rounded-xl p-3 text-center text-sm font-black ${result.success ? "border border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : "border border-red-400/25 bg-red-500/10 text-red-300"}`}>{result.success ? "УСПЕШНЫЙ АПГРЕЙД" : "АПГРЕЙД НЕ УДАЛСЯ"}</div>}
          {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-center text-sm text-red-200">{error}</div>}
        </div>
      </section>

      <section className="grid gap-4 bg-[#090b16] px-4 py-6 md:grid-cols-2 sm:px-8 sm:py-8">
        <InventoryPanel title="ТВОЙ ИНВЕНТАРЬ" empty="Выбери скин или используй только баланс" items={inventory} active={inputId} onPick={chooseInput} />
        <InventoryPanel title="ДОСТУПНЫЕ ЦЕЛИ" empty={total > 0 ? "Нет более дорогих целей" : "Сначала выбери скин или добавь баланс"} items={availableTargets} active={targetId} onPick={chooseTarget} />
      </section>
    </div>
  </main>;
}

function UpgradeFragmentLayer({ leftItem, rightItem, winningItem, phase, particles }: { leftItem: Item | null; rightItem: Item | null; winningItem: Item | null; phase: Phase; particles: Particle[] }) {
  if (phase === "idle" || particles.length !== 4) return null;

  return <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
    {leftItem && <QuarterPack item={leftItem} side="left" phase="burst" particles={particles} />}
    {rightItem && phase === "burst" && <QuarterPack item={rightItem} side="right" phase="burst" particles={particles} />}
    {winningItem && phase === "gather" && <QuarterPack item={winningItem} side="right" phase="gather" particles={particles} />}
  </div>;
}

function QuarterPack({ item, side, phase, particles }: { item: Item; side: "left" | "right"; phase: "burst" | "gather"; particles: Particle[] }) {
  const safeImage = item.image.replace(/"/g, "%22");
  const quarters = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;
  const originX = side === "left" ? "calc(11% - 29px)" : "calc(89% - 29px)";

  return <>{quarters.map(([qx, qy], index) => {
    const particle = particles[index];
    const horizontal = side === "left" ? -1 : 1;
    const burstX = horizontal * (70 + Math.abs(particle.x));
    const burstY = particle.y;
    const gatherX = -330 + (qx ? 29 : -29);
    const gatherY = qy ? 18 : -18;
    const style: CSSProperties & Record<string, string> = {
      left: originX,
      top: "calc(50% - 18px)",
      width: "58px",
      height: "36px",
      backgroundImage: `url("${safeImage}")`,
      backgroundSize: "200% 200%",
      backgroundPosition: `${qx * 100}% ${qy * 100}%`,
      backgroundRepeat: "no-repeat",
      animationDelay: `${phase === "gather" ? particle.delay : 0}ms`,
      "--burst-x": `${burstX}px`,
      "--burst-y": `${burstY}px`,
      "--gather-x": `${gatherX}px`,
      "--gather-y": `${gatherY}px`,
      "--r": `${particle.rotate}deg`,
    };

    return <span key={`${item.id}-${side}-${phase}-${index}`} className={`upgrade-quarter ${phase === "gather" ? "upgrade-quarter-gather" : "upgrade-quarter-burst"}`} style={style} />;
  })}<style jsx>{`
    .upgrade-quarter{position:absolute;display:block;border-radius:3px;border:1px solid rgba(255,255,255,.2);box-shadow:0 0 14px rgba(255,255,255,.1),0 0 22px rgba(124,58,237,.4);will-change:transform,opacity,filter;opacity:0}
    .upgrade-quarter-burst{animation:upgradeQuarterBurst ${BURST_MS}ms cubic-bezier(.12,.72,.16,1) forwards}
    .upgrade-quarter-gather{animation:upgradeQuarterGather ${GATHER_MS}ms cubic-bezier(.16,.78,.18,1) forwards}
    @keyframes upgradeQuarterBurst{0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.2) saturate(1.05)}8%{opacity:1}54%{opacity:.95;filter:brightness(1.08) saturate(1.08)}100%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.58);filter:brightness(.9) saturate(.9)}}
    @keyframes upgradeQuarterGather{0%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.52);filter:brightness(1.4) saturate(1.18)}14%{opacity:1}68%{opacity:1;filter:brightness(1.18) saturate(1.1)}100%{opacity:1;transform:translate(var(--gather-x),var(--gather-y)) rotate(0deg) scale(1);filter:brightness(1.35) saturate(1.1)}}
  `}</style></>;
}

function WeaponSlot({ item, side, onShuffle, imageHidden }: { item: Item | null; side: "left" | "right"; onShuffle: () => void; imageHidden: boolean }) {
  return <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-center">
    <p className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500 sm:text-xs">{side === "left" ? "ТВОЙ СКИН" : "ЦЕЛЕВОЙ СКИН"}</p>
    <div className="relative h-20 w-full max-w-[180px] overflow-visible rounded-2xl border border-violet-400/15 bg-[#111424] p-3 shadow-[0_0_30px_rgba(95,48,255,.10)] sm:h-32 sm:max-w-[250px]">
      {item ? <Image src={item.image} alt={item.name} fill className={`object-contain p-3 drop-shadow-[0_0_20px_rgba(116,65,255,.45)] transition-opacity duration-150 ${imageHidden ? "opacity-0" : "opacity-100"}`} unoptimized /> : <div className="grid h-full place-items-center text-[9px] font-black uppercase tracking-[.14em] text-zinc-600">Выбери предмет</div>}
    </div>
    <button type="button" onClick={onShuffle} aria-label="Сбросить выбор" disabled={imageHidden} className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/15 bg-[#171a2b] text-lg text-violet-200 transition hover:bg-violet-500/15 disabled:opacity-50 sm:h-11 sm:w-11">⌘</button>
    {item ? <div className="max-w-[180px]"><p className="truncate text-[10px] font-black sm:text-sm">{item.name}</p><p className="mt-1 text-xs font-black text-[#f2b84d] sm:text-sm">{money(item.price)} Z</p></div> : side === "left" ? <p className="text-[9px] text-zinc-600">Можно играть балансом</p> : null}
  </div>;
}

function InventoryPanel({ title, empty, items, active, onPick }: { title: string; empty: string; items: Item[]; active: string; onPick: (id: string) => void }) {
  return <section className="rounded-[24px] border border-violet-400/10 bg-[#101322] p-4 shadow-[0_18px_60px_rgba(0,0,0,.16)] sm:p-5">
    <h2 className="mb-5 text-sm font-black uppercase tracking-[.16em] text-zinc-300 sm:text-lg">{title}</h2>
    {items.length === 0 ? <div className="rounded-xl border border-white/5 p-6 text-sm text-zinc-500">{empty}</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map((item) => <button key={item.id} type="button" onClick={() => onPick(item.id)} className={`rounded-2xl border p-3 text-left transition ${active === item.id ? "border-violet-400 bg-violet-500/10 shadow-[0_0_28px_rgba(108,58,255,.16)]" : "border-white/5 bg-[#0c0f1b] hover:border-violet-400/35"}`}><div className="relative mb-2 h-20"><Image src={item.image} alt={item.name} fill className="object-contain" unoptimized /></div><p className="truncate text-[8px] font-black uppercase tracking-wider text-violet-300/60">{item.rarity}</p><p className="truncate text-xs font-black sm:text-sm">{item.name}</p><p className="mt-1 text-xs font-black text-[#f2b84d] sm:text-sm">{money(item.price)} Z</p></button>)}</div>}
  </section>;
}

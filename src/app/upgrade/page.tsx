"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Item = { id: string; name: string; rarity: string; image: string; price: number };
type Result = { success: boolean; chance: number; roll: number; target: Item; resultItem: Item | null; inputItem: Item | null; inputValue: number; balanceTopUp: number; totalInputValue: number };
type Attempt = { input: Item | null; target: Item; chance: number };
type Phase = "idle" | "burst" | "gather";
type Particle = { id: number; x: number; y: number; size: number; rotate: number; delay: number; sourceX: number; sourceY: number };

const SPIN_MS = 4200;
const BREAK_MS = 4100;
const MIN_CHANCE = 25;
const money = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);
const chanceFor = (input: number, target: number) => Math.max(MIN_CHANCE, Math.min(100, target > 0 ? (input / target) * 100 : MIN_CHANCE));

function makeParticles(seed: number) {
  const next = (n: number) => {
    const x = Math.sin(n * 987.133 + seed * 0.00031) * 10000;
    return x - Math.floor(x);
  };

  return Array.from({ length: 46 }, (_, id) => ({
    id,
    x: (next(id * 7 + 1) - 0.5) * (150 + next(id * 7 + 2) * 150),
    y: (next(id * 7 + 3) - 0.5) * (110 + next(id * 7 + 4) * 150),
    size: 14 + next(id * 7 + 5) * 22,
    rotate: (next(id * 7 + 6) - 0.5) * 760,
    delay: next(id * 7 + 7) * 260,
    sourceX: next(id * 7 + 8) * 100,
    sourceY: next(id * 7 + 9) * 100,
  }));
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

  const input = inventory.find((x) => x.id === inputId) || null;
  const target = targets.find((x) => x.id === targetId) || null;
  const total = (input?.price || 0) + topUp;
  const chance = target && total > 0 ? chanceFor(total, target.price) : MIN_CHANCE;
  const shownChance = attempt?.chance ?? chance;
  const winDegrees = Math.max(90, Math.min(360, shownChance * 3.6));
  const displayInput = attempt?.input ?? input;
  const displayTarget = attempt?.target ?? target;

  async function load() {
    const r = await fetch("/api/upgrader", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Не удалось загрузить апгрейдер");
    const inv = Array.isArray(d.inventory) ? d.inventory : [];
    setInventory(inv);
    setTargets(Array.isArray(d.targets) ? d.targets : []);
    setBalance(Number(d.balance) || 0);
    return inv as Item[];
  }

  useEffect(() => {
    load().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  function chooseInput(id: string) {
    if (busy || spinning || animating) return;
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
    const base = input?.price || 0;
    const wanted = target.price * (percent / 100);
    const required = Math.max(0, Math.min(balance, wanted - base));
    setTopUp(Math.round(required * 100) / 100);
  }

  function chooseMultiplier(multiplier: number) {
    if (total <= 0 || busy || spinning || animating) return;
    const desired = total * multiplier;
    const candidates = targets.filter((x) => x.price > total);
    const closest = candidates.reduce<Item | null>((best, item) => !best || Math.abs(item.price - desired) < Math.abs(best.price - desired) ? item : best, null);
    if (closest) setTargetId(closest.id);
  }

  function startRoulette(data: Result) {
    const sector = Math.max(90, Math.min(359.64, data.chance * 3.6));
    const margin = Math.min(7, Math.max(2.5, sector * 0.04, (360 - sector) * 0.04));
    const winMin = margin;
    const winMax = Math.max(winMin + 0.01, sector - margin);
    const loseMin = Math.min(359.5, sector + margin);
    const loseMax = Math.max(loseMin + 0.01, 360 - margin);
    const landing = data.success
      ? winMin + Math.random() * (winMax - winMin)
      : loseMin + Math.random() * (loseMax - loseMin);

    setAngle((current) => {
      const norm = ((current % 360) + 360) % 360;
      return current + 2160 + ((landing - norm + 360) % 360);
    });
    setSpinning(true);
    window.setTimeout(() => {
      setSpinning(false);
      void playResult(data);
    }, SPIN_MS + 80);
  }

  async function playResult(data: Result) {
    setResult(data);
    setParticles(makeParticles(Date.now()));
    setAnimating(true);
    setPhase("burst");

    if (data.success) {
      window.setTimeout(() => setPhase("gather"), 1450);
    }

    window.setTimeout(async () => {
      try {
        const fresh = await load();
        if (data.success && data.resultItem) {
          const won = fresh.find((x) => x.id === data.resultItem!.id) || fresh.find((x) => x.name.toLowerCase() === data.resultItem!.name.toLowerCase());
          setInputId(won?.id || "");
        } else {
          setInputId("");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка синхронизации инвентаря");
      } finally {
        setTargetId("");
        setTopUp(0);
        setAttempt(null);
        setParticles([]);
        setPhase("idle");
        setAnimating(false);
      }
    }, BREAK_MS);
  }

  async function upgrade() {
    if (!target || total <= 0 || target.price <= total || topUp > balance || busy || spinning || animating) return;
    setBusy(true);
    setError("");
    setResult(null);
    setAttempt({ input, target, chance });

    try {
      const r = await fetch("/api/upgrader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: input?.id || "", targetId: target.id, balanceTopUp: topUp, idempotencyKey: crypto.randomUUID() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Апгрейд не выполнен");
      setBalance((v) => Math.max(0, v - topUp));
      startRoulette(d);
    } catch (e) {
      setAttempt(null);
      setError(e instanceof Error ? e.message : "Ошибка апгрейда");
    } finally {
      setBusy(false);
    }
  }

  const availableTargets = useMemo(() => {
    const seen = new Set<string>();
    return targets.filter((x) => {
      const key = x.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return total > 0 ? x.price > total : true;
    });
  }, [targets, total]);

  if (loading) return <main className="min-h-screen bg-[#090b16] p-8 text-center text-zinc-400">Загружаем апгрейдер...</main>;

  return <main className="min-h-screen bg-[#090b16] pb-24 text-white">
    <div className="mx-auto max-w-[1280px] overflow-hidden">
      <section className="relative overflow-hidden border-y border-violet-400/10 bg-[radial-gradient(circle_at_50%_34%,rgba(110,49,255,.20),transparent_30%),radial-gradient(circle_at_20%_25%,rgba(255,119,34,.09),transparent_28%),linear-gradient(180deg,#0d1020_0%,#090b16_82%)] px-4 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(120deg,transparent,rgba(115,53,255,.05),transparent)]" />

        <div className="relative mb-6 flex items-center justify-between gap-4 rounded-2xl border border-violet-400/10 bg-[#0e1120]/90 px-5 py-4 shadow-[0_16px_60px_rgba(0,0,0,.22)]">
          <div><p className="text-[9px] font-black tracking-[.34em] text-violet-300">ZEONGGSTORE</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Апгрейдер</h1></div>
          <div className="text-right"><p className="text-[8px] font-black tracking-[.22em] text-zinc-500">БАЛАНС</p><p className="mt-1 font-black text-[#f2b84d]">{money(balance)} Z</p></div>
        </div>

        <div className="relative grid grid-cols-[.9fr_1.25fr_.9fr] items-center gap-2 sm:gap-8">
          <WeaponSlot item={displayInput} side="left" onShuffle={() => setInputId("")} hidden={animating} />

          <div className="relative mx-auto flex w-full max-w-[460px] flex-col items-center">
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

          <WeaponSlot item={displayTarget} side="right" onShuffle={() => setTargetId("")} hidden={animating} />
        </div>

        {animating && attempt && result && (
          <ParticleAnimation success={result.success} target={attempt.target} input={attempt.input} particles={particles} phase={phase} />
        )}

        <div className="relative z-20 mx-auto mt-7 max-w-5xl rounded-[24px] border border-violet-400/10 bg-[#0e1120]/70 p-4 shadow-[0_22px_80px_rgba(0,0,0,.18)] sm:p-6">
          <div className="mb-3 flex items-center justify-between text-sm font-black text-zinc-300 sm:text-lg"><span>Добавить баланс</span><span className="text-[#f2b84d]">{money(topUp)} Z</span></div>
          <div className="rounded-2xl border border-white/5 bg-[#151827] px-4 py-4">
            <input type="range" min="0" max={Math.max(0, Math.floor(balance * 100) / 100)} step="0.01" value={topUp} onChange={(e) => setTopUp(Math.max(0, Math.min(balance, Number(e.target.value))))} disabled={spinning || busy || animating} className="h-3 w-full accent-[#7b46ff]" />
          </div>
          <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-2xl border border-violet-400/10 bg-[#121525] text-xs font-black sm:text-sm">
            <button type="button" onClick={() => setTopUp(0)} className="min-h-14 border-r border-violet-400/10 text-[#ff9b43]">ϟ</button>
            {[30,50,70].map((p) => <button key={p} type="button" onClick={() => setChancePreset(p)} className="min-h-14 border-r border-violet-400/10 transition hover:bg-violet-500/10">{p}%</button>)}
            {[2,5,10].map((m) => <button key={m} type="button" onClick={() => chooseMultiplier(m)} className="min-h-14 border-r border-violet-400/10 last:border-r-0 transition hover:bg-orange-400/10">X{m}</button>)}
          </div>
          <button type="button" onClick={() => void upgrade()} disabled={!target || total <= 0 || target.price <= total || topUp > balance || busy || spinning || animating} className="mt-5 w-full rounded-2xl bg-[linear-gradient(90deg,#6730df,#9138f5,#ff7f2a)] py-5 text-base font-black tracking-[.16em] text-white shadow-[0_14px_40px_rgba(105,52,255,.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
            {animating ? "АНИМАЦИЯ..." : spinning ? "АПГРЕЙД ИДЁТ..." : busy ? "ОБРАБОТКА..." : "СДЕЛАТЬ АПГРЕЙД"}
          </button>
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

function WeaponSlot({ item, side, onShuffle, hidden }: { item: Item | null; side: "left" | "right"; onShuffle: () => void; hidden?: boolean }) {
  return <div className={`relative z-10 flex flex-col items-center justify-center gap-3 text-center transition-all duration-500 ${hidden ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}>
    <p className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500 sm:text-xs">{side === "left" ? "ТВОЙ СКИН" : "ЦЕЛЕВОЙ СКИН"}</p>
    <div className="relative h-20 w-full max-w-[180px] rounded-2xl border border-violet-400/15 bg-[#111424] p-3 shadow-[0_0_30px_rgba(95,48,255,.10)] sm:h-32 sm:max-w-[250px]">
      {item ? <Image src={item.image} alt={item.name} fill className="object-contain p-3 drop-shadow-[0_0_20px_rgba(116,65,255,.45)]" unoptimized /> : <div className="grid h-full place-items-center text-[9px] font-black uppercase tracking-[.14em] text-zinc-600">Выбери предмет</div>}
    </div>
    <button type="button" onClick={onShuffle} aria-label="Сбросить выбор" className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/15 bg-[#171a2b] text-lg text-violet-200 transition hover:bg-violet-500/15 sm:h-11 sm:w-11">⌘</button>
    {item ? <div className="max-w-[180px]"><p className="truncate text-[10px] font-black sm:text-sm">{item.name}</p><p className="mt-1 text-xs font-black text-[#f2b84d] sm:text-sm">{money(item.price)} Z</p></div> : side === "left" ? <p className="text-[9px] text-zinc-600">Можно играть балансом</p> : null}
  </div>;
}

function ParticleAnimation({ success, target, input, particles, phase }: { success: boolean; target: Item; input: Item | null; particles: Particle[]; phase: Phase }) {
  const source = (item: Item | null, side: "left" | "right", gather = false) => {
    if (!item?.image) return null;
    return <div className={`pointer-events-none absolute top-[76px] z-40 h-[150px] w-[250px] sm:top-[118px] ${side === "left" ? "left-[1%] sm:left-[11%]" : "right-[1%] sm:right-[11%]"}`}>
      {particles.map((p) => <span key={`${side}-${gather ? "g" : "b"}-${p.id}`} className={`upgrade-fragment ${gather ? "upgrade-fragment-gather" : "upgrade-fragment-burst"}`} style={{
        width: `${p.size}px`,
        height: `${Math.max(10, p.size * 0.72)}px`,
        left: `calc(50% + ${(p.sourceX - 50) * 1.65}px)`,
        top: `calc(50% + ${(p.sourceY - 50) * 0.92}px)`,
        backgroundImage: `url("${item.image}")`,
        backgroundSize: "250px 150px",
        backgroundPosition: `${-p.sourceX * 2.5}px ${-p.sourceY * 1.5}px`,
        ["--x" as string]: `${gather ? -p.x : p.x}px`,
        ["--y" as string]: `${gather ? -p.y : p.y}px`,
        ["--r" as string]: `${p.rotate}deg`,
        animationDelay: `${p.delay}ms`,
      } as React.CSSProperties} />)}
    </div>;
  };

  return <div className="absolute inset-0 z-30 overflow-hidden">
    {success ? <>
      {source(target, "right")}
      {phase === "gather" && source(target, "left", true)}
    </> : <>
      {source(input, "left")}
      {source(target, "right")}
    </>}
    <style jsx>{`
      .upgrade-fragment{position:absolute;display:block;border-radius:3px;box-shadow:0 0 14px rgba(122,70,255,.24);will-change:transform,opacity;}
      .upgrade-fragment-burst{animation:upgradeBurst 2.7s cubic-bezier(.12,.72,.16,1) forwards;}
      .upgrade-fragment-gather{animation:upgradeGather 2.35s cubic-bezier(.16,.78,.18,1) forwards;opacity:0;}
      @keyframes upgradeBurst{0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(.82);filter:brightness(1.5)}9%{opacity:1}55%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(.42);filter:brightness(.7)}}
      @keyframes upgradeGather{0%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(.38);filter:brightness(.7)}16%{opacity:1}72%{opacity:1;filter:brightness(1.15)}100%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.8)}}
    `}</style>
  </div>;
}

function InventoryPanel({ title, empty, items, active, onPick }: { title: string; empty: string; items: Item[]; active: string; onPick: (id: string) => void }) {
  return <section className="rounded-[24px] border border-violet-400/10 bg-[#101322] p-4 shadow-[0_18px_60px_rgba(0,0,0,.16)] sm:p-5">
    <h2 className="mb-5 text-sm font-black uppercase tracking-[.16em] text-zinc-300 sm:text-lg">{title}</h2>
    {items.length === 0 ? <div className="rounded-xl border border-white/5 p-6 text-sm text-zinc-500">{empty}</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => <button key={item.id} type="button" onClick={() => onPick(item.id)} className={`rounded-2xl border p-3 text-left transition ${active === item.id ? "border-violet-400 bg-violet-500/10 shadow-[0_0_28px_rgba(108,58,255,.16)]" : "border-white/5 bg-[#0c0f1b] hover:border-violet-400/35"}`}>
        <div className="relative mb-2 h-20"><Image src={item.image} alt={item.name} fill className="object-contain" unoptimized /></div>
        <p className="truncate text-[8px] font-black uppercase tracking-wider text-violet-300/60">{item.rarity}</p>
        <p className="truncate text-xs font-black sm:text-sm">{item.name}</p>
        <p className="mt-1 text-xs font-black text-[#f2b84d] sm:text-sm">{money(item.price)} Z</p>
      </button>)}
    </div>}
  </section>;
}

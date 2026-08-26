"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Item = { id: string; name: string; rarity: string; image: string; price: number };
type Result = { success: boolean; chance: number; roll: number; target: Item; resultItem: Item | null; inputItem: Item | null; inputValue: number; balanceTopUp: number; totalInputValue: number };
type Attempt = { input: Item | null; target: Item; chance: number };
type Particle = { id: number; x: number; y: number; size: number; rotate: number; delay: number; sourceX: number; sourceY: number };

const SPIN_MS = 4200;
const BREAK_MS = 3600;
const MIN_CHANCE = 25;
const money = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);
const chanceFor = (input: number, target: number) => Math.max(MIN_CHANCE, Math.min(100, target > 0 ? (input / target) * 100 : MIN_CHANCE));

function makeParticles(seed: number) {
  const next = (n: number) => {
    const x = Math.sin(n * 999.91 + seed * 91.7) * 10000;
    return x - Math.floor(x);
  };
  return Array.from({ length: 54 }, (_, id) => ({
    id,
    x: (next(id * 4 + 1) - 0.5) * 250,
    y: (next(id * 4 + 2) - 0.5) * 190,
    size: 9 + next(id * 4 + 3) * 18,
    rotate: (next(id * 4 + 4) - 0.5) * 900,
    delay: next(id * 4 + 5) * 380,
    sourceX: Math.floor(next(id * 4 + 6) * 5) * 25,
    sourceY: Math.floor(next(id * 4 + 7) * 4) * 25,
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
  const [phase, setPhase] = useState<"idle" | "break" | "gather">("idle");

  const input = inventory.find((x) => x.id === inputId) || null;
  const target = targets.find((x) => x.id === targetId) || null;
  const total = (input?.price || 0) + topUp;
  const chance = target && total > 0 ? chanceFor(total, target.price) : MIN_CHANCE;
  const shownChance = attempt?.chance ?? chance;
  const degrees = Math.max(90, Math.min(360, shownChance * 3.6));
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

  useEffect(() => { load().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);

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
    const margin = Math.min(6, Math.max(2, sector * 0.04, (360 - sector) * 0.04));
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
    const frozen = attempt;
    const generated = makeParticles(Date.now());
    setParticles(generated);
    setAnimating(true);
    setPhase("break");

    if (data.success) {
      window.setTimeout(() => setPhase("gather"), 1500);
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
        setResult(data);
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

  if (loading) return <main className="min-h-screen bg-[#161219] p-8 text-center text-zinc-400">Загружаем апгрейдер...</main>;

  return <main className="min-h-screen bg-[#171219] pb-24 text-white">
    <div className="mx-auto max-w-[1280px] overflow-hidden">
      <section className="relative min-h-[660px] overflow-hidden border-y border-red-500/10 bg-[radial-gradient(circle_at_50%_34%,rgba(164,31,23,.30),transparent_45%),linear-gradient(180deg,#1c1114_0%,#171219_72%)] px-4 pt-8 sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_center,rgba(255,74,39,.15),transparent_70%)]" />
        <div className="relative grid grid-cols-[1fr_1.15fr_1fr] items-center gap-3 pt-12 sm:gap-8">
          <WeaponSlot item={displayInput} side="left" onShuffle={() => setInputId("")} hidden={animating} />
          <div className="relative mx-auto flex w-full max-w-[430px] flex-col items-center">
            <div className="relative h-[310px] w-[310px] sm:h-[390px] sm:w-[390px]">
              <div className="absolute inset-[7%] rounded-full border-[8px] border-[#7b1717] bg-[#120f13] shadow-[0_0_35px_rgba(255,52,25,.35)]" style={{ background: `conic-gradient(from 0deg,#f0442d 0deg ${degrees}deg,#4d1821 ${degrees}deg 360deg)` }}>
                <div className="absolute inset-[8px] rounded-full bg-[#171319] shadow-inner">
                  <div className="absolute inset-x-0 top-[18%] text-center text-[10px] font-black tracking-[.25em] text-[#ffb36e]">ШАНС</div>
                  <div className="absolute inset-x-0 top-[30%] text-center text-4xl font-black sm:text-6xl">{shownChance.toFixed(1)}%</div>
                  <div className="absolute inset-x-0 bottom-[17%] text-center text-[10px] font-black tracking-[.25em] text-zinc-500">WIN / LOSE</div>
                </div>
                <div className="absolute left-1/2 top-[-10px] z-30 h-[calc(100%+20px)] w-1 -translate-x-1/2" style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 50%", transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.08,.72,.12,1)` : "transform .25s ease-out" }}>
                  <div className="absolute left-1/2 top-0 h-12 w-[3px] -translate-x-1/2 rounded-full bg-[#ff694c] shadow-[0_0_18px_#ff2d15]" />
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-xs font-black uppercase tracking-[.35em] text-zinc-600">ZeonGG Upgrade</p>
          </div>
          <WeaponSlot item={displayTarget} side="right" onShuffle={() => setTargetId("")} hidden={animating} />
        </div>

        {animating && attempt && (
          <ParticleAnimation success={!!result?.success || false} target={attempt.target} input={attempt.input} particles={particles} phase={phase} />
        )}

        <div className="relative z-20 mx-auto mt-2 max-w-5xl">
          <div className="mb-3 flex items-center justify-between text-xl font-black text-zinc-300"><span>Добавить баланс</span><span className="text-emerald-300">{money(topUp)} Z</span></div>
          <div className="rounded-2xl bg-[#28232d] px-4 py-3 shadow-inner">
            <input type="range" min="0" max={Math.max(0, Math.floor(balance * 100) / 100)} step="0.01" value={topUp} onChange={(e) => setTopUp(Math.max(0, Math.min(balance, Number(e.target.value))))} disabled={spinning || busy || animating} className="h-3 w-full accent-[#ff5b41]" />
          </div>
          <div className="mt-5 grid grid-cols-7 overflow-hidden rounded-2xl border border-white/5 bg-[#2a252e] text-sm font-black sm:text-base">
            <button type="button" onClick={() => setTopUp(0)} className="min-h-16 border-r border-white/5 text-[#ff9a5a]">ϟ</button>
            {[30,50,70].map((p) => <button key={p} type="button" onClick={() => setChancePreset(p)} className="min-h-16 border-r border-white/5">{p}%</button>)}
            {[2,5,10].map((m) => <button key={m} type="button" onClick={() => chooseMultiplier(m)} className="min-h-16 border-r border-white/5 last:border-r-0">X{m}</button>)}
          </div>
          <button type="button" onClick={() => void upgrade()} disabled={!target || total <= 0 || target.price <= total || topUp > balance || busy || spinning || animating} className="mt-6 w-full rounded-2xl bg-[#9f4144] py-6 text-xl font-black tracking-wide text-white shadow-[0_10px_40px_rgba(116,28,31,.35)] transition hover:bg-[#b84c4f] disabled:cursor-not-allowed disabled:opacity-45">
            {animating ? "АНИМАЦИЯ..." : spinning ? "АПГРЕЙД ИДЁТ..." : busy ? "ОБРАБОТКА..." : "АПГРЕЙД"}
          </button>
          {result && !animating && <div className={`mt-4 rounded-xl p-3 text-center font-black ${result.success ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{result.success ? "УСПЕШНЫЙ АПГРЕЙД" : "АПГРЕЙД НЕ УДАЛСЯ"}</div>}
          {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-center text-sm text-red-200">{error}</div>}
        </div>
      </section>

      <section className="grid gap-4 bg-[#171219] px-4 py-8 md:grid-cols-2 sm:px-8">
        <InventoryPanel title="ИНВЕНТАРЬ" empty="Выбери скин или используй только баланс" items={inventory} active={inputId} onPick={chooseInput} />
        <InventoryPanel title="СКИНЫ" empty={total > 0 ? "Нет более дорогих целей" : "Сначала выбери скин или добавь баланс"} items={availableTargets} active={targetId} onPick={chooseTarget} />
      </section>
    </div>
  </main>;
}

function WeaponSlot({ item, side, onShuffle, hidden }: { item: Item | null; side: "left" | "right"; onShuffle: () => void; hidden?: boolean }) {
  return <div className={`flex flex-col items-center justify-center gap-4 text-center transition-opacity duration-500 ${hidden ? "opacity-0" : "opacity-100"}`}>
    <p className="text-lg font-black uppercase leading-none sm:text-2xl">ВЫБЕРИТЕ<br />СКИН</p>
    <div className="relative h-24 w-full max-w-[250px] sm:h-32">
      {item ? <Image src={item.image} alt={item.name} fill className="object-contain drop-shadow-[0_0_22px_rgba(255,53,35,.45)]" unoptimized /> : <div className="h-full w-full bg-[radial-gradient(ellipse_at_center,rgba(255,65,42,.3),transparent_70%)]" />}
    </div>
    <button type="button" onClick={onShuffle} className="grid h-16 w-16 place-items-center rounded-2xl bg-[#6f2929] text-3xl shadow-[0_0_25px_rgba(255,44,27,.3)]">⌘</button>
    <div className="h-2 w-full max-w-[260px] rounded-full bg-gradient-to-r from-transparent via-[#ff3d27] to-transparent shadow-[0_0_18px_#ff3d27]" />
    {item && <div className="max-w-[240px]"><p className="truncate font-black">{item.name}</p><p className="font-black text-[#ffb05d]">{money(item.price)} Z</p></div>}
    {!item && side === "left" && <p className="text-xs text-zinc-500">Можно играть только балансом</p>}
  </div>;
}

function ParticleAnimation({ success, target, input, particles, phase }: { success: boolean; target: Item; input: Item | null; particles: Particle[]; phase: "idle" | "break" | "gather" }) {
  const [w, h] = [250, 130];
  const burst = (item: Item | null, side: "left" | "right", gather = false) => {
    if (!item?.image) return null;
    return <div className={`pointer-events-none absolute top-[130px] ${side === "left" ? "left-[3%] sm:left-[12%]" : "right-[3%] sm:right-[12%]"} h-[130px] w-[250px]`}>
      {particles.map((p) => <span key={`${side}-${p.id}`} className={`upgrade-fragment ${gather ? "upgrade-fragment-gather" : "upgrade-fragment-burst"}`} style={{
        width: p.size,
        height: p.size * 0.62,
        left: `calc(50% + ${(p.sourceX - 50) * 0.12}px)`,
        top: `calc(50% + ${(p.sourceY - 37.5) * 0.12}px)`,
        backgroundImage: `url("${item.image}")`,
        backgroundSize: "250px 130px",
        backgroundPosition: `${-p.sourceX * 2.5}px ${-p.sourceY * 1.3}px`,
        ["--x" as string]: `${gather ? -p.x : p.x}px`,
        ["--y" as string]: `${gather ? -p.y : p.y}px`,
        ["--r" as string]: `${p.rotate}deg`,
        animationDelay: `${p.delay}ms`,
      } as React.CSSProperties} />)}
    </div>;
  };

  return <div className="absolute inset-0 z-30 overflow-hidden">
    {success ? <>
      {burst(target, "right")}
      {phase === "gather" && burst(target, "left", true)}
    </> : <>
      {burst(input, "left")}
      {burst(target, "right")}
    </>}
    <style jsx>{`
      .upgrade-fragment{position:absolute;display:block;border-radius:2px;box-shadow:0 0 8px rgba(255,255,255,.16);will-change:transform,opacity;}
      .upgrade-fragment-burst{animation:upgradeBurst 2.25s cubic-bezier(.12,.72,.16,1) forwards;}
      .upgrade-fragment-gather{animation:upgradeGather 1.8s cubic-bezier(.16,.78,.18,1) forwards;opacity:0;}
      @keyframes upgradeBurst{0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(.65);filter:brightness(1.45)}12%{opacity:1;filter:brightness(1.25)}72%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(.45);filter:brightness(.75)}}
      @keyframes upgradeGather{0%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(.45)}18%{opacity:1}82%{opacity:1}100%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.5)}}
    `}</style>
  </div>;
}

function InventoryPanel({ title, empty, items, active, onPick }: { title: string; empty: string; items: Item[]; active: string; onPick: (id: string) => void }) {
  return <section className="rounded-2xl border border-white/5 bg-[#26222b] p-5">
    <h2 className="mb-5 text-2xl font-medium text-zinc-300">{title}</h2>
    {items.length === 0 ? <div className="rounded-xl border border-white/5 p-6 text-sm text-zinc-500">{empty}</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => <button key={item.id} type="button" onClick={() => onPick(item.id)} className={`rounded-xl border p-3 text-left transition ${active === item.id ? "border-red-400 bg-red-500/10 shadow-[0_0_24px_rgba(255,62,45,.12)]" : "border-white/5 bg-[#1b1820] hover:border-red-400/40"}`}>
        <div className="relative mb-2 h-20"><Image src={item.image} alt={item.name} fill className="object-contain" unoptimized /></div>
        <p className="truncate text-[9px] font-black uppercase tracking-wider text-zinc-500">{item.rarity}</p>
        <p className="truncate text-sm font-black">{item.name}</p>
        <p className="mt-1 text-sm font-black text-[#ffb05d]">{money(item.price)} Z</p>
      </button>)}
    </div>}
  </section>;
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Item = { id: string; name: string; rarity: string; image: string; price: number };
type Result = { success: boolean; chance: number; roll: number; target: Item; resultItem: Item | null; inputItem: Item | null; inputValue: number; balanceTopUp: number; totalInputValue: number };
type Attempt = { input: Item | null; target: Item; chance: number };
type Phase = "idle" | "burst" | "gather";
type Particle = { id: number; x: number; y: number; size: number; rotate: number; delay: number; sourceX: number; sourceY: number };
type FragmentMode = "burst" | "gather" | null;

const SPIN_MS = 4200;
const BURST_MS = 2200;
const GATHER_MS = 2200;
const BREAK_MS = BURST_MS + GATHER_MS;
const MIN_CHANCE = 25;
const money = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);
const chanceFor = (input: number, target: number) => Math.max(MIN_CHANCE, Math.min(100, target > 0 ? (input / target) * 100 : MIN_CHANCE));

function rarityGlow(rarity: string) {
  const key = rarity.trim().toLowerCase();
  if (key.includes("nameless")) return { hex: "#ff3b30", rgb: "255,59,48" };
  if (key.includes("arcana")) return { hex: "#ff7a18", rgb: "255,122,24" };
  if (key.includes("legendary")) return { hex: "#ffd21f", rgb: "255,210,31" };
  if (key.includes("epic")) return { hex: "#c14dff", rgb: "193,77,255" };
  if (key.includes("rare")) return { hex: "#3b82f6", rgb: "59,130,246" };
  if (key.includes("uncommon")) return { hex: "#22c55e", rgb: "34,197,94" };
  return { hex: "#9ca3af", rgb: "156,163,175" };
}

function makeParticles(seed: number) {
  const next = (n: number) => {
    const x = Math.sin(n * 981.73 + seed * 0.00021) * 10000;
    return x - Math.floor(x);
  };
  const particles: Particle[] = [];
  let id = 0;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 9; col++) {
    const jitterX = (next(id * 11 + 1) - 0.5) * 5;
    const jitterY = (next(id * 11 + 2) - 0.5) * 6;
    particles.push({ id, x: (next(id * 11 + 3) - 0.5) * (165 + next(id * 11 + 4) * 210), y: (next(id * 11 + 5) - 0.5) * (125 + next(id * 11 + 6) * 180), size: 14 + next(id * 11 + 7) * 20, rotate: (next(id * 11 + 8) - 0.5) * 720, delay: next(id * 11 + 9) * 180, sourceX: 7 + col * 10.6 + jitterX, sourceY: 8 + row * 12.8 + jitterY }); id++;
  }
  return particles;
}

function preloadImage(src?: string | null) { if (!src || typeof window === "undefined") return; const img = new window.Image(); img.decoding = "async"; img.src = src; }

const skinColorCache = new Map<string, { hex: string; rgb: string }>();
function rgbToHex(r: number, g: number, b: number) { return "#" + [r, g, b] .map((v) => Math.round(v).toString(16).padStart(2, "0")) .join(""); }
function extractSkinColor( src?: string | null, fallback = rarityGlow("") ): Promise<{ hex: string; rgb: string }> { if (!src || typeof window === "undefined") { return Promise.resolve(fallback); }
const cached = skinColorCache.get(src); if (cached) return Promise.resolve(cached);
return new Promise((resolve) => { const image = new window.Image(); image.crossOrigin = "anonymous";
image.onload = () => {
  try {
    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      resolve(fallback);
      return;
    }

    const scale = Math.min(
      size / image.naturalWidth,
      size / image.naturalHeight
    );

    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    context.clearRect(0, 0, size, size);
    context.drawImage(
      image,
      (size - width) / 2,
      (size - height) / 2,
      width,
      height
    );

    const pixels = context.getImageData(0, 0, size, size).data;

    const buckets = new Map<
      string,
      {
        r: number;
        g: number;
        b: number;
        count: number;
        saturation: number;
      }
    >();

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const alpha = pixels[i + 3];

      if (alpha < 80) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const brightness = (r + g + b) / 3;

      if (
        brightness > 245 ||
        brightness < 18 ||
        saturation < 0.18
      ) {
        continue;
      }

      const step = 32;
      const key =
        Math.floor(r / step) * step +
        "," +
        Math.floor(g / step) * step +
        "," +
        Math.floor(b / step) * step;

      const current = buckets.get(key);

      if (current) {
        current.r += r;
        current.g += g;
        current.b += b;
        current.count += 1;
        current.saturation += saturation;
      } else {
        buckets.set(key, {
          r,
          g,
          b,
          count: 1,
          saturation,
        });
      }
    }

    let winner:
      | {
          r: number;
          g: number;
          b: number;
          count: number;
          saturation: number;
        }
      | undefined;

    let winnerScore = -1;

    for (const bucket of buckets.values()) {
      const score =
        bucket.count *
        (1 + (bucket.saturation / bucket.count) * 2);

      if (score > winnerScore) {
        winner = bucket;
        winnerScore = score;
      }
    }

    if (!winner) {
      skinColorCache.set(src, fallback);
      resolve(fallback);
      return;
    }

    const r = winner.r / winner.count;
    const g = winner.g / winner.count;
    const b = winner.b / winner.count;

    const color = {
      hex: rgbToHex(r, g, b),
      rgb:
        Math.round(r) +
        "," +
        Math.round(g) +
        "," +
        Math.round(b),
    };

    skinColorCache.set(src, color);
    resolve(color);
  } catch {
    skinColorCache.set(src, fallback);
    resolve(fallback);
  }
};

image.onerror = () => {
  skinColorCache.set(src, fallback);
  resolve(fallback);
};

image.src = src;}); }
export default function UpgradePage() {
  const [inventory, setInventory] = useState<Item[]>([]); const [targets, setTargets] = useState<Item[]>([]); const [balance, setBalance] = useState(0); const [inputId, setInputId] = useState(""); const [targetId, setTargetId] = useState(""); const [topUp, setTopUp] = useState(0); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [spinning, setSpinning] = useState(false); const [angle, setAngle] = useState(0); const [error, setError] = useState(""); const [attempt, setAttempt] = useState<Attempt | null>(null); const [result, setResult] = useState<Result | null>(null); const [animating, setAnimating] = useState(false); const [particles, setParticles] = useState<Particle[]>([]); const [phase, setPhase] = useState<Phase>("idle"); const [optimisticInput, setOptimisticInput] = useState<Item | null>(null);
  const inventoryInput = inventory.find((x) => x.id === inputId) || null; const input = optimisticInput && inputId === optimisticInput.id ? optimisticInput : inventoryInput; const target = targets.find((x) => x.id === targetId) || null; const total = (input?.price || 0) + topUp; const chance = target && total > 0 ? chanceFor(total, target.price) : MIN_CHANCE; const shownChance = attempt?.chance ?? chance; const winDegrees = Math.max(90, Math.min(360, shownChance * 3.6)); const displayInput = attempt?.input ?? input; const displayTarget = attempt?.target ?? target;
  async function load() { const r = await fetch("/api/upgrader", { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Не удалось загрузить апгрейдер"); const inv = Array.isArray(d.inventory) ? d.inventory : []; setInventory(inv); setTargets(Array.isArray(d.targets) ? d.targets : []); setBalance(Number(d.balance) || 0); return inv as Item[]; }
  useEffect(() => { load().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  function chooseInput(id: string) { if (busy || spinning || animating) return; setOptimisticInput(null); setInputId((current) => current === id ? "" : id); setTopUp(0); setError(""); setResult(null); }
  function chooseTarget(id: string) { if (busy || spinning || animating) return; setTargetId(id); setError(""); setResult(null); }
  function setChancePreset(percent: number) { if (!target || busy || spinning || animating) return; const wanted = target.price * (percent / 100); setTopUp(Math.round(Math.max(0, Math.min(balance, wanted - (input?.price || 0))) * 100) / 100); }
  function chooseMultiplier(multiplier: number) { if (total <= 0 || busy || spinning || animating) return; const desired = total * multiplier; const candidates = targets.filter((x) => x.price > total); const closest = candidates.reduce<Item | null>((best, item) => !best || Math.abs(item.price - desired) < Math.abs(best.price - desired) ? item : best, null); if (closest) setTargetId(closest.id); }
  function startRoulette(data: Result) { if (data.success) preloadImage(data.resultItem?.image || data.target?.image); const sector = Math.max(90, Math.min(359.64, data.chance * 3.6)); const margin = Math.min(7, Math.max(2.5, sector * 0.04, (360 - sector) * 0.04)); const winMin = margin; const winMax = Math.max(winMin + 0.01, sector - margin); const loseMin = Math.min(359.5, sector + margin); const loseMax = Math.max(loseMin + 0.01, 360 - margin); const landing = data.success ? winMin + Math.random() * (winMax - winMin) : loseMin + Math.random() * (loseMax - loseMin); setAngle((current) => { const norm = ((current % 360) + 360) % 360; return current + 2160 + ((landing - norm + 360) % 360); }); setSpinning(true); window.setTimeout(() => { setSpinning(false); void playResult(data); }, SPIN_MS + 100); }
  async function playResult(data: Result) { setResult(data); setParticles(makeParticles(Date.now())); setPhase("burst"); setAnimating(true);
if (data.success) {
  window.setTimeout(() => setPhase("gather"), BURST_MS);
}

window.setTimeout(() => {
  if (data.success && data.resultItem) {
    const won = data.resultItem;
    setOptimisticInput(won);
    setInventory((current) => {
      const oldId = data.inputItem?.id || attempt?.input?.id;
      const filtered = current.filter(
        (item) =>
          item.id !== oldId &&
          item.id !== won.id &&
          item.name.toLowerCase() !== won.name.toLowerCase()
      );
      return [won, ...filtered];
    });
    setInputId(won.id);
    setTargetId("");
    setTopUp(0);
    setAttempt(null);
    setParticles([]);
    setPhase("idle");
    setAnimating(false);
    void load().then((fresh) => {
      const serverWinner =
        fresh.find((item) => item.id === won.id) ||
        fresh.find((item) => item.name.toLowerCase() === won.name.toLowerCase());
      if (serverWinner) {
        setOptimisticInput(serverWinner);
        setInputId(serverWinner.id);
      }
    }).catch((e) =>
      setError(e instanceof Error ? e.message : "Ошибка синхронизации инвентаря")
    );
  } else {
    const oldId = data.inputItem?.id || attempt?.input?.id;
    if (oldId) {
      setInventory((current) => current.filter((item) => item.id !== oldId));
    }
    setOptimisticInput(null);
    setInputId("");
    setTargetId("");
    setTopUp(0);
    setAttempt(null);
    setParticles([]);
    setPhase("idle");
    setAnimating(false);
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Ошибка синхронизации инвентаря")
    );
  }
}, data.success ? BREAK_MS : BURST_MS);}
  async function upgrade() { if (!target || total <= 0 || target.price <= total || topUp > balance || busy || spinning || animating) return; setBusy(true); setError(""); setResult(null); setAttempt({ input, target, chance }); try { const r = await fetch("/api/upgrader", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: input?.id || "", targetId: target.id, balanceTopUp: topUp, idempotencyKey: crypto.randomUUID() }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Апгрейд не выполнен"); setBalance((v) => Math.max(0, v - topUp)); startRoulette(d); } catch (e) { setAttempt(null); setError(e instanceof Error ? e.message : "Ошибка апгрейда"); } finally { setBusy(false); } }
  const availableTargets = useMemo(() => { const seen = new Set<string>(); return targets.filter((x) => { const key = x.name.trim().toLowerCase(); if (seen.has(key)) return false; seen.add(key); return total > 0 ? x.price > total : true; }); }, [targets, total]);
  const leftFragmentItem =
    animating && result ? displayInput : null;

  const leftFragmentMode: FragmentMode =
    leftFragmentItem ? "burst" : null;

  const rightFragmentItem =
    animating && result ? displayTarget : null;

  const rightFragmentMode: FragmentMode =
    rightFragmentItem
      ? result?.success && phase === "gather"
        ? "gather"
        : "burst"
      : null;

  if (loading) return <main className="min-h-screen bg-[#090b16] p-8 text-center text-zinc-400">Загружаем апгрейдер...</main>;
  return <main className="min-h-screen bg-[#090b16] pb-24 text-white"><div className="mx-auto max-w-[1280px] overflow-hidden"><section className="relative overflow-hidden border-y border-violet-400/10 bg-[radial-gradient(circle_at_50%_34%,rgba(110,49,255,.20),transparent_30%),radial-gradient(circle_at_20%_25%,rgba(255,119,34,.09),transparent_28%),linear-gradient(180deg,#0d1020_0%,#090b16_82%)] px-4 py-8 sm:px-8 sm:py-10"><div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(120deg,transparent,rgba(115,53,255,.05),transparent)]" /><div className="relative mb-6 flex items-center justify-between gap-4 rounded-2xl border border-violet-400/10 bg-[#0e1120]/90 px-5 py-4 shadow-[0_16px_60px_rgba(0,0,0,.22)]"><div><p className="text-[9px] font-black tracking-[.34em] text-violet-300">ZEONGGSTORE</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Апгрейдер</h1></div><div className="text-right"><p className="text-[8px] font-black tracking-[.22em] text-zinc-500">БАЛАНС</p><p className="mt-1 font-black text-[#f2b84d]">{money(balance)} Z</p></div></div><div className="relative grid min-h-[300px] grid-cols-[.9fr_1.25fr_.9fr] items-center gap-2 sm:min-h-[470px] sm:gap-8"><WeaponSlot item={displayInput} side="left" onShuffle={() => { setOptimisticInput(null); setInputId(""); }} imageHidden={animating} fragmentItem={leftFragmentItem} fragmentMode={leftFragmentMode} particles={particles} /><div className="relative z-10 mx-auto flex w-full max-w-[460px] flex-col items-center"><div className="relative h-[250px] w-[250px] sm:h-[390px] sm:w-[390px]"><div className="absolute inset-[7%] rounded-full border-[8px] border-[#261a4b] bg-[#0b0d18] shadow-[0_0_42px_rgba(111,51,255,.22)]" style={{ background: `conic-gradient(from 0deg,#ff8a2a 0deg ${winDegrees}deg,#7a3cf2 ${winDegrees}deg 360deg)` }}><div className="absolute inset-[8px] rounded-full bg-[#0d0f1c] shadow-[inset_0_0_38px_rgba(0,0,0,.48)]"><div className="absolute inset-x-0 top-[18%] text-center text-[9px] font-black tracking-[.25em] text-[#b8a5ff]">ШАНС</div><div className="absolute inset-x-0 top-[31%] text-center text-4xl font-black sm:text-6xl">{shownChance.toFixed(1)}%</div><div className="absolute inset-x-0 bottom-[17%] text-center text-[9px] font-black tracking-[.24em] text-zinc-500">WIN / LOSE</div></div><div className="absolute left-1/2 top-[-10px] z-30 h-[calc(100%+20px)] w-1 -translate-x-1/2" style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 50%", transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.08,.72,.12,1)` : "transform .25s ease-out" }}><div className="absolute left-1/2 top-0 h-12 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,.8)]" /></div></div></div><p className="mt-3 text-center text-[10px] font-black uppercase tracking-[.42em] text-violet-300/55">ZeonGG Upgrade</p></div><WeaponSlot item={displayTarget} side="right" onShuffle={() => setTargetId("")} imageHidden={animating} fragmentItem={rightFragmentItem} fragmentMode={rightFragmentMode} particles={particles} /></div><div className="relative z-20 mx-auto mt-7 max-w-5xl rounded-[24px] border border-violet-400/10 bg-[#0e1120]/70 p-4 shadow-[0_22px_80px_rgba(0,0,0,.18)] sm:p-6"><div className="mb-3 flex items-center justify-between text-sm font-black text-zinc-300 sm:text-lg"><span>Добавить баланс</span><span className="text-[#f2b84d]">{money(topUp)} Z</span></div><div className="rounded-2xl border border-white/5 bg-[#151827] px-4 py-4"><input type="range" min="0" max={Math.max(0, Math.floor(balance * 100) / 100)} step="0.01" value={topUp} onChange={(e) => setTopUp(Math.max(0, Math.min(balance, Number(e.target.value))))} disabled={spinning || busy || animating} className="h-3 w-full accent-[#7b46ff]" /></div><div className="mt-4 grid grid-cols-7 overflow-hidden rounded-2xl border border-violet-400/10 bg-[#121525] text-xs font-black sm:text-sm"><button type="button" onClick={() => setTopUp(0)} className="min-h-14 border-r border-violet-400/10 text-[#ff9b43]">ϟ</button>{[30,50,70].map((p) => <button key={p} type="button" onClick={() => setChancePreset(p)} className="min-h-14 border-r border-violet-400/10 transition hover:bg-violet-500/10">{p}%</button>)}{[2,5,10].map((m) => <button key={m} type="button" onClick={() => chooseMultiplier(m)} className="min-h-14 border-r border-violet-400/10 last:border-r-0 transition hover:bg-orange-400/10">X{m}</button>)}</div><button type="button" onClick={() => void upgrade()} disabled={!target || total <= 0 || target.price <= total || topUp > balance || busy || spinning || animating} className="mt-5 w-full rounded-2xl bg-[linear-gradient(90deg,#6730df,#9138f5,#ff7f2a)] py-5 text-base font-black tracking-[.16em] text-white shadow-[0_14px_40px_rgba(105,52,255,.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">{animating ? "АНИМАЦИЯ..." : spinning ? "АПГРЕЙД ИДЁТ..." : busy ? "ОБРАБОТКА..." : "СДЕЛАТЬ АПГРЕЙД"}</button>{result && !animating && <div className={`mt-4 rounded-xl p-3 text-center text-sm font-black ${result.success ? "border border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : "border border-red-400/25 bg-red-500/10 text-red-300"}`}>{result.success ? "УСПЕШНЫЙ АПГРЕЙД" : "АПГРЕЙД НЕ УДАЛСЯ"}</div>}{error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-center text-sm text-red-200">{error}</div>}</div></section><section className="grid gap-4 bg-[#090b16] px-4 py-6 md:grid-cols-2 sm:px-8 sm:py-8"><InventoryPanel title="ТВОЙ ИНВЕНТАРЬ" empty="Выбери скин или используй только баланс" items={inventory} active={inputId} onPick={chooseInput} /><InventoryPanel title="ДОСТУПНЫЕ ЦЕЛИ" empty={total > 0 ? "Нет более дорогих целей" : "Сначала выбери скин или добавь баланс"} items={availableTargets} active={targetId} onPick={chooseTarget} /></section></div></main>;
}

function WeaponSlot({ item, side, onShuffle, imageHidden, fragmentItem, fragmentMode, particles }: { item: Item | null; side: "left" | "right"; onShuffle: () => void; imageHidden: boolean; fragmentItem: Item | null; fragmentMode: FragmentMode; particles: Particle[] }) { return <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-center"><p className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500 sm:text-xs">{side === "left" ? "ТВОЙ СКИН" : "ЦЕЛЕВОЙ СКИН"}</p><div className="relative h-20 w-full max-w-[180px] overflow-visible rounded-2xl border border-violet-400/15 bg-[#111424] p-3 shadow-[0_0_30px_rgba(95,48,255,.10)] sm:h-32 sm:max-w-[250px]">{item ? <Image src={item.image} alt={item.name} fill className={`object-contain p-3 drop-shadow-[0_0_20px_rgba(116,65,255,.45)] transition-opacity duration-150 ${imageHidden ? "opacity-0" : "opacity-100"}`} unoptimized /> : <div className="grid h-full place-items-center text-[9px] font-black uppercase tracking-[.14em] text-zinc-600">Выбери предмет</div>}{fragmentItem && fragmentMode && particles.length > 0 && <SkinFragments item={fragmentItem} particles={particles} mode={fragmentMode} />}</div><button type="button" onClick={onShuffle} aria-label="Сбросить выбор" disabled={imageHidden} className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/15 bg-[#171a2b] text-lg text-violet-200 transition hover:bg-violet-500/15 disabled:opacity-50 sm:h-11 sm:w-11">⌘</button>{item ? <div className="max-w-[180px]"><p className="truncate text-[10px] font-black sm:text-sm">{item.name}</p><p className="mt-1 text-xs font-black text-[#f2b84d] sm:text-sm">{money(item.price)} Z</p></div> : side === "left" ? <p className="text-[9px] text-zinc-600">Можно играть балансом</p> : null}</div>; }

function SkinFragments({ item, particles, mode }: { item: Item; particles: Particle[]; mode: Exclude<FragmentMode, null> }) { const safeImage = item.image.replace(/\"/g, "%22"); const width = 200; const height = 130; const fallbackGlow = rarityGlow(item.rarity); const [glow, setGlow] = useState(fallbackGlow); useEffect(() => { let cancelled = false; setGlow(fallbackGlow); void extractSkinColor(item.image, fallbackGlow).then((color) => { if (!cancelled) setGlow(color); }); return () => { cancelled = true; }; }, [item.image, item.rarity]); return <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">{particles.map((p) => { const cropX = -(p.sourceX / 100) * width; const cropY = -(p.sourceY / 100) * height; const style: CSSProperties & Record<string,string> = { width:`${p.size}px`, height:`${Math.max(12,p.size*.72)}px`, left:`calc(${p.sourceX}% - ${p.size/2}px)`, top:`calc(${p.sourceY}% - ${p.size*.36}px)`, backgroundImage:`url("${safeImage}")`, backgroundSize:`${width}px ${height}px`, backgroundRepeat:"no-repeat", backgroundPosition:`${cropX}px ${cropY}px`, animationDelay:`${p.delay}ms`, "--x":`${mode === "gather" ? -p.x : p.x}px`, "--y":`${mode === "gather" ? -p.y : p.y}px`, "--r":`${p.rotate}deg`, "--glow":glow.hex, "--glow-rgb":glow.rgb }; return <span key={`${item.id}-${mode}-${p.id}`} className={`upgrade-fragment ${mode === "gather" ? "upgrade-fragment-gather" : "upgrade-fragment-burst"}`} style={style} />; })}<style jsx>{`.upgrade-fragment{position:absolute;display:block;border-radius:4px;box-shadow:0 0 14px rgba(var(--glow-rgb),.52),0 0 30px rgba(var(--glow-rgb),.24),0 0 2px var(--glow);will-change:transform,opacity,filter;opacity:0;border:1px solid rgba(var(--glow-rgb),.32)}.upgrade-fragment-burst{animation:upgradeBurst ${BURST_MS}ms cubic-bezier(.12,.72,.16,1) forwards}.upgrade-fragment-gather{animation:upgradeGather ${GATHER_MS}ms cubic-bezier(.16,.78,.18,1) forwards}@keyframes upgradeBurst{0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.35) saturate(1.12)}8%{opacity:1}48%{opacity:1;filter:brightness(1.08) saturate(1.08)}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(.55);filter:brightness(.65) saturate(.9)}}@keyframes upgradeGather{0%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(.48);filter:brightness(.7) saturate(.9)}12%{opacity:1}68%{opacity:1;filter:brightness(1.16) saturate(1.1)}100%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.7) saturate(1.25)}}`}</style></div>; }

function InventoryPanel({ title, empty, items, active, onPick }: { title: string; empty: string; items: Item[]; active: string; onPick: (id: string) => void }) { return <section className="rounded-[24px] border border-violet-400/10 bg-[#101322] p-4 shadow-[0_18px_60px_rgba(0,0,0,.16)] sm:p-5"><h2 className="mb-5 text-sm font-black uppercase tracking-[.16em] text-zinc-300 sm:text-lg">{title}</h2>{items.length === 0 ? <div className="rounded-xl border border-white/5 p-6 text-sm text-zinc-500">{empty}</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map((item) => <button key={item.id} type="button" onClick={() => onPick(item.id)} className={`rounded-2xl border p-3 text-left transition ${active === item.id ? "border-violet-400 bg-violet-500/10 shadow-[0_0_28px_rgba(108,58,255,.16)]" : "border-white/5 bg-[#0c0f1b] hover:border-violet-400/35"}`}><div className="relative mb-2 h-20"><Image src={item.image} alt={item.name} fill className="object-contain" unoptimized /></div><p className="truncate text-[8px] font-black uppercase tracking-wider text-violet-300/60">{item.rarity}</p><p className="truncate text-xs font-black sm:text-sm">{item.name}</p><p className="mt-1 text-xs font-black text-[#f2b84d] sm:text-sm">{money(item.price)} Z</p></button>)}</div>}</section>; }

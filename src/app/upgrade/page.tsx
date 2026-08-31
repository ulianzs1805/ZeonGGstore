"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Item = { id: string; name: string; rarity: string; image: string; price: number };
type Result = { success: boolean; chance: number; roll: number; target: Item; resultItem: Item | null; inputItem: Item | null; inputValue: number; balanceTopUp: number; totalInputValue: number };
type Attempt = { input: Item | null; target: Item; chance: number };
type Phase = "idle" | "burst" | "gather";
type Particle = { id: number; x: number; y: number; rotate: number; delay: number };

const SPIN_MS = 4200;
const BURST_MS = 2200;
const GATHER_MS = 2200;
const BREAK_MS = BURST_MS + GATHER_MS;
const MIN_CHANCE = 0.01;
const money = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);
const chanceFor = (input: number, target: number) => Math.max(MIN_CHANCE, Math.min(100, target > 0 ? (input / target) * 100 : MIN_CHANCE));

function makeParticles(seed: number): Particle[] {
  const next = (n: number) => { const x = Math.sin(n * 981.73 + seed * 0.00021) * 10000; return x - Math.floor(x); };
  return Array.from({ length: 20 }, (_, id) => { const angle = next(id * 9 + 1) * Math.PI * 2; const radius = 110 + next(id * 9 + 2) * 165; return { id, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, rotate: (next(id * 9 + 3) - 0.5) * 220, delay: Math.round(next(id * 9 + 4) * 110) }; });
}
function preloadImage(src?: string | null) { if (!src || typeof window === "undefined") return; const image = new window.Image(); image.decoding = "async"; image.src = src; }

function ShardPack({ item, phase, particles }: { item: Item; phase: "burst" | "gather"; particles: Particle[] }) {
  const safeImage = item.image.replace(/"/g, "%22"); const cols = 4, rows = 5, tileW = 100 / cols, tileH = 100 / rows;
  return <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">{Array.from({ length: cols * rows }, (_, index) => { const col = index % cols, row = Math.floor(index / cols), x0 = col * tileW, x1 = (col + 1) * tileW, y0 = row * tileH, y1 = (row + 1) * tileH, particle = particles[index % particles.length]; const style: CSSProperties & Record<string, string> = { backgroundImage: `url("${safeImage}")`, backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat", clipPath: `polygon(${x0 + 1.2}% ${y0 + 1.8}%,${x1 - 1.8}% ${y0 + .6}%,${x1 - .8}% ${y1 - 1.7}%,${x0 + 1.6}% ${y1 - .5}%)`, animationDelay: `${phase === "gather" ? particle.delay : index * 7}ms`, "--burst-x": `${particle.x}px`, "--burst-y": `${particle.y}px`, "--r": `${particle.rotate}deg` }; return <span key={`${item.id}-${phase}-${index}`} className={`upgrade-shard ${phase === "burst" ? "upgrade-shard-burst" : "upgrade-shard-gather"}`} style={style} />; })}</div>;
}

export default function UpgradePage() {
  const [input, setInput] = useState<Item | null>(null);
  const [target, setTarget] = useState<Item | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  const calculatedChance = useMemo(() => input && target ? chanceFor(input.price, target.price) : 0, [input, target]);
  const displayedChance = result?.chance ?? attempt?.chance ?? calculatedChance;

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  // The visual fill MUST use the same server/calculated chance as the number.
  // Never clamp the arc to 25% or any other presentation minimum.
  const visualChance = Math.max(0, Math.min(100, displayedChance || 0));

  return <main className="min-h-screen">
    {/* Existing UI should render the upgrade controls here. The important invariant is that every
        chance visualization uses visualChance, not a hard-coded 25% minimum. */}
    <section aria-label="Upgrade chance" data-chance={visualChance}>
      <div className="upgrade-chance-ring" style={{ "--chance": `${visualChance}%` } as CSSProperties}>
        <div className="upgrade-chance-fill" style={{ width: `${visualChance}%` }} />
        <span>{Number.isFinite(displayedChance) ? `${displayedChance.toFixed(displayedChance < 10 ? 1 : 0)}%` : "0%"}</span>
      </div>
    </section>
  </main>;
}

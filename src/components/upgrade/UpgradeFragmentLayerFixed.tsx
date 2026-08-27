"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Item = { id: string; rarity: string; image: string };
type Phase = "idle" | "burst" | "gather";
type Particle = { id: number; x: number; y: number; size: number; rotate: number; delay: number; sourceX: number; sourceY: number };

const BURST_MS = 2200;
const GATHER_MS = 2200;

function rarityGlow(rarity: string) {
  const key = rarity.trim().toLowerCase();
  if (key.includes("nameless")) return "255,59,48";
  if (key.includes("arcana")) return "255,122,24";
  if (key.includes("legendary")) return "255,210,31";
  if (key.includes("epic")) return "193,77,255";
  if (key.includes("rare")) return "59,130,246";
  if (key.includes("uncommon")) return "34,197,94";
  return "156,163,175";
}

function FragmentSet({ item, particles, side, phase }: { item: Item; particles: Particle[]; side: "left" | "right"; phase: Phase }) {
  const [glow, setGlow] = useState(rarityGlow(item.rarity));
  useEffect(() => { setGlow(rarityGlow(item.rarity)); }, [item.rarity]);
  const safeImage = item.image.replace(/"/g, "%22");
  return <>{particles.map((p) => {
    const anchorX = side === "left" ? 16 + p.sourceX * 0.60 : 84 - (100 - p.sourceX) * 0.60;
    const anchorY = 18 + p.sourceY * 0.64;
    const sideOffset = side === "left" ? -300 : 300;
    const burstX = p.x + sideOffset;
    const burstY = p.y;
    const style: CSSProperties & Record<string, string> = {
      width: `${p.size}px`, height: `${Math.max(12, p.size * 0.72)}px`,
      left: `calc(${anchorX}% - ${p.size / 2}px)`, top: `calc(${anchorY}% - ${p.size * 0.36}px)`,
      backgroundImage: `url("${safeImage}")`, backgroundSize: "200px 130px", backgroundRepeat: "no-repeat",
      backgroundPosition: `${-(p.sourceX / 100) * 200}px ${-(p.sourceY / 100) * 130}px`,
      animationDelay: `${p.delay}ms`, "--burst-x": `${burstX}px`, "--burst-y": `${burstY}px`, "--r": `${p.rotate}deg`, "--glow-rgb": glow,
    };
    return <span key={`${side}-${item.id}-${phase}-${p.id}`} className={`upgrade-fixed-fragment ${phase === "gather" ? "upgrade-fixed-fragment-gather" : "upgrade-fixed-fragment-burst"}`} style={style} />;
  })}</>;
}

export default function UpgradeFragmentLayerFixed({ leftItem, rightItem, phase, particles }: { leftItem: Item | null; rightItem: Item | null; phase: Phase; particles: Particle[] }) {
  if (phase === "idle" || particles.length === 0) return null;
  return <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
    {leftItem && phase === "burst" && <FragmentSet item={leftItem} particles={particles} side="left" phase="burst" />}
    {rightItem && <FragmentSet item={rightItem} particles={particles} side="right" phase={phase} />}
    <style jsx>{`
      .upgrade-fixed-fragment{position:absolute;display:block;border-radius:4px;opacity:0;border:1px solid rgba(var(--glow-rgb),.32);box-shadow:0 0 14px rgba(var(--glow-rgb),.52),0 0 30px rgba(var(--glow-rgb),.24);will-change:transform,opacity,filter}
      .upgrade-fixed-fragment-burst{animation:upgradeFixedBurst ${BURST_MS}ms cubic-bezier(.12,.72,.16,1) forwards}
      .upgrade-fixed-fragment-gather{animation:upgradeFixedGather ${GATHER_MS}ms cubic-bezier(.16,.78,.18,1) forwards}
      @keyframes upgradeFixedBurst{0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.35) saturate(1.12)}8%{opacity:1}48%{opacity:1}100%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.55);filter:brightness(.65) saturate(.9)}}
      @keyframes upgradeFixedGather{0%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.55);filter:brightness(.65) saturate(.9)}12%{opacity:1}68%{opacity:1;filter:brightness(1.16) saturate(1.1)}100%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.7) saturate(1.25)}}
    `}</style>
  </div>;
}

"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Item = { id: string; name: string; rarity: string; image: string };
type Phase = "idle" | "burst" | "gather";
type Particle = { id: number; x: number; y: number; size: number; rotate: number; delay: number; sourceX: number; sourceY: number };

const BURST_MS = 2200;
const GATHER_MS = 2200;

const skinColorCache = new Map<string, { hex: string; rgb: string }>();

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

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function extractSkinColor(src: string, fallback: { hex: string; rgb: string }) {
  if (typeof window === "undefined") return Promise.resolve(fallback);
  const cached = skinColorCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise<{ hex: string; rgb: string }>((resolve) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const size = 72;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(fallback);
        const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        const pixels = context.getImageData(0, 0, size, size).data;
        let best: { r: number; g: number; b: number; score: number } | null = null;
        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i]; const g = pixels[i + 1]; const b = pixels[i + 2]; const a = pixels[i + 3];
          if (a < 80) continue;
          const max = Math.max(r, g, b); const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const brightness = (r + g + b) / 3;
          if (brightness < 18 || brightness > 245 || saturation < 0.18) continue;
          const score = saturation * 180 + Math.abs(brightness - 128);
          if (!best || score > best.score) best = { r, g, b, score };
        }
        const color = best ? { hex: rgbToHex(best.r, best.g, best.b), rgb: `${Math.round(best.r)},${Math.round(best.g)},${Math.round(best.b)}` } : fallback;
        skinColorCache.set(src, color);
        resolve(color);
      } catch {
        resolve(fallback);
      }
    };
    image.onerror = () => resolve(fallback);
    image.src = src;
  });
}

function FragmentSet({ item, particles, side, phase }: { item: Item; particles: Particle[]; side: "left" | "right"; phase: Phase }) {
  const fallback = rarityGlow(item.rarity);
  const [glow, setGlow] = useState(fallback);
  const safeImage = item.image.replace(/"/g, "%22");

  useEffect(() => {
    let cancelled = false;
    setGlow(fallback);
    void extractSkinColor(item.image, fallback).then((color) => {
      if (!cancelled) setGlow(color);
    });
    return () => { cancelled = true; };
  }, [item.image, item.rarity]);

  return <>
    {particles.map((p) => {
      const horizontalOffset = side === "left" ? -300 : 300;
      const startX = side === "left" ? 18 + p.sourceX * 0.62 : 82 - (100 - p.sourceX) * 0.62;
      const startY = 18 + p.sourceY * 0.64;
      const burstX = p.x + horizontalOffset;
      const burstY = p.y;
      const gatherX = -burstX;
      const gatherY = -burstY;
      const style: CSSProperties & Record<string, string> = {
        width: `${p.size}px`, height: `${Math.max(12, p.size * 0.72)}px`,
        left: `calc(${startX}% - ${p.size / 2}px)`, top: `calc(${startY}% - ${p.size * 0.36}px)`,
        backgroundImage: `url("${safeImage}")`, backgroundSize: "200px 130px", backgroundRepeat: "no-repeat",
        backgroundPosition: `${-(p.sourceX / 100) * 200}px ${-(p.sourceY / 100) * 130}px`,
        animationDelay: `${p.delay}ms`, "--burst-x": `${burstX}px`, "--burst-y": `${burstY}px`,
        "--gather-x": `${gatherX}px`, "--gather-y": `${gatherY}px`, "--r": `${p.rotate}deg`,
        "--glow": glow.hex, "--glow-rgb": glow.rgb,
      };
      return <span key={`${side}-${item.id}-${phase}-${p.id}`} className={`upgrade-common-fragment ${phase === "gather" ? "upgrade-common-fragment-gather" : "upgrade-common-fragment-burst"}`} style={style} />;
    })}
  </>;
}

export default function UpgradeFragmentLayer({ leftItem, rightItem, phase, particles }: { leftItem: Item | null; rightItem: Item | null; phase: Phase; particles: Particle[] }) {
  if (phase === "idle" || particles.length === 0) return null;
  return <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
    {leftItem && phase === "burst" && <FragmentSet item={leftItem} particles={particles} side="left" phase="burst" />}
    {rightItem && <FragmentSet item={rightItem} particles={particles} side="right" phase={phase} />}
    <style jsx>{`
      .upgrade-common-fragment{position:absolute;display:block;border-radius:4px;opacity:0;border:1px solid rgba(var(--glow-rgb),.32);box-shadow:0 0 14px rgba(var(--glow-rgb),.52),0 0 30px rgba(var(--glow-rgb),.24),0 0 2px var(--glow);will-change:transform,opacity,filter}
      .upgrade-common-fragment-burst{animation:upgradeCommonBurst ${BURST_MS}ms cubic-bezier(.12,.72,.16,1) forwards}
      .upgrade-common-fragment-gather{animation:upgradeCommonGather ${GATHER_MS}ms cubic-bezier(.16,.78,.18,1) forwards}
      @keyframes upgradeCommonBurst{0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(1);filter:brightness(1.35) saturate(1.12)}8%{opacity:1}48%{opacity:1}100%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.55);filter:brightness(.65) saturate(.9)}}
      @keyframes upgradeCommonGather{0%{opacity:0;transform:translate(var(--burst-x),var(--burst-y)) rotate(var(--r)) scale(.55);filter:brightness(.65) saturate(.9)}12%{opacity:1}68%{opacity:1;filter:brightness(1.16) saturate(1.1)}100%{opacity:0;transform:translate(var(--gather-x),var(--gather-y)) rotate(0deg) scale(1);filter:brightness(1.7) saturate(1.25)}}
    `}</style>
  </div>;
}

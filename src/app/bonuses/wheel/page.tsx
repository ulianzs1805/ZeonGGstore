"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";

type WheelItem = { type: string; label: string; icon: string; weight: number };
type LetterState = { collected: string[]; completed: boolean };
type InnerItem = { key: string; title: string; subtitle?: string; image?: string; icon?: string };
type Result = { rewardType: string; rewardValue: number | null; caseId: string | null; label: string; sectorIndex: number; metadata?: { letter?: string; slotId?: string; [key: string]: unknown }; innerRoulette?: { items: InnerItem[]; selectedIndex: number; title: string } | null; letterState?: LetterState };

const LETTER_SLOTS = ["Z", "E", "O", "N", "G1", "G2"] as const;
const LETTER_LABELS = ["Z", "E", "O", "N", "G", "G"];
const LETTER_IMAGE = "/bonuses/Bonuses%20Z%20E%20O%20N%20G%20G%20.PNG";
const fallbackWheel: WheelItem[] = [
  { type: "ZEON_SECRET", label: "ZEONGG Secret", icon: "Z", weight: 10 },
  { type: "DEPOSIT_BONUS", label: "Депозит +5–35%", icon: "%", weight: 12 },
  { type: "FREE_CASE", label: "Бесплатный кейс", icon: "▣", weight: 17 },
  { type: "ZCOIN_RAIN", label: "Z-Coin Rain", icon: "Z¢", weight: 16 },
  { type: "Z_BOOST", label: "+25% к следующей награде", icon: "+25%", weight: 13 },
  { type: "LUCKY_DROP", label: "Lucky Drop", icon: "✦", weight: 11 },
  { type: "SAFE_OPEN", label: "Safe Open", icon: "◉", weight: 9 },
  { type: "DOUBLE_DROP", label: "Double Drop", icon: "2×", weight: 12 },
];
const descriptions: Record<string, string> = {
  ZEON_SECRET: "Случайная недостающая буква из шести слотов ZEONGG. После шестой — 50–500 Z-Coin.",
  DEPOSIT_BONUS: "После остановки большого барабана в центре выпадет бонус к пополнению от 5% до 35%.",
  FREE_CASE: "Бесплатное открытие активного кейса без списания Z-Coin.",
  ZCOIN_RAIN: "Случайная пачка Z-Coin выпадает во внутренней рулетке.",
  Z_BOOST: "Следующая подходящая награда получает +25% Z-Coin.",
  LUCKY_DROP: "Улучшает шанс получить более редкий дроп при следующем открытии кейса.",
  SAFE_OPEN: "Защита следующего открытия от самого слабого варианта дропа.",
  DOUBLE_DROP: "Следующее подходящее открытие может дать дополнительный случайный дроп.",
};

function LetterSprite({ index }: { index: number }) {
  return <div className="h-12 w-12 overflow-hidden rounded-xl border border-violet-300/25 bg-violet-500/10"><div className="h-full w-[600%] bg-contain bg-no-repeat" style={{ backgroundImage: `url(${LETTER_IMAGE})`, backgroundPosition: `${index * 20}% center` }} /></div>;
}

function InnerRoulette({ data, spinning }: { data: NonNullable<Result["innerRoulette"]>; spinning: boolean }) {
  const items = Array.from({ length: 6 }).flatMap((_, round) => data.items.map((item) => ({ ...item, round })));
  const selected = data.selectedIndex + data.items.length * 3;
  return <div className="absolute inset-x-3 top-1/2 z-50 -translate-y-1/2 overflow-hidden rounded-3xl border border-violet-300/35 bg-[#080c14]/95 p-4 shadow-[0_20px_80px_rgba(0,0,0,.8)] backdrop-blur-xl sm:inset-x-12 sm:p-5"><div className="mb-3 text-center text-[10px] font-black uppercase tracking-[.25em] text-violet-300">{data.title}</div><div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 py-3"><div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-[3px] -translate-x-1/2 bg-violet-200 shadow-[0_0_24px_rgba(196,181,253,.95)]" /><div className="flex w-max gap-2" style={{ transform: `translateX(calc(50% - 61px - ${selected * 124}px))`, transition: spinning ? "transform 4s cubic-bezier(.12,.72,.17,1)" : "transform .3s ease" }}>{items.map((item) => <div key={`${item.round}-${item.key}`} className="flex h-[104px] w-[116px] shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#111724] p-2 text-center"><div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-violet-300/20 bg-violet-500/10 text-xs font-black">{item.image ? <img src={item.image} alt="" className="h-full w-full object-contain" /> : item.icon ?? "✦"}</div><p className="mt-2 line-clamp-2 text-[10px] font-black leading-4">{item.title}</p>{item.subtitle && <p className="text-[8px] font-bold uppercase text-slate-500">{item.subtitle}</p>}</div>)}</div></div></div>;
}

export default function FortuneWheelPage() {
  const [wheel, setWheel] = useState(fallbackWheel);
  const [spinning, setSpinning] = useState(false);
  const [innerSpinning, setInnerSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const [letterState, setLetterState] = useState<LetterState>({ collected: [], completed: false });
  useEffect(() => { void fetch("/api/bonuses/fortune", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (r.ok) { setWheel(d.wheel ?? fallbackWheel); setLetterState(d.letterState ?? { collected: [], completed: false }); } }).catch(() => {}); }, []);
  const sectorAngle = 360 / Math.max(1, wheel.length);
  const background = useMemo(() => { const colors = ["#24124d", "#17213d", "#35153d", "#112e39", "#332015", "#28183f", "#132d32", "#32172b"]; return `conic-gradient(${wheel.map((_, i) => `${colors[i % colors.length]} ${i * sectorAngle}deg ${(i + 1) * sectorAngle}deg`).join(",")})`; }, [wheel, sectorAngle]);
  const spin = async () => {
    if (spinning || innerSpinning || !wheel.length) return;
    setSpinning(true); setResult(null); setError("");
    try {
      const r = await fetch("/api/bonuses/fortune", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Не удалось запустить барабан.");
      const index = Number.isInteger(d.sectorIndex) ? d.sectorIndex : 0;
      setRotation((current) => current - 360 * 6 - index * sectorAngle);
      window.setTimeout(() => { setSpinning(false); setResult(d); setLetterState(d.letterState ?? letterState); if (d.innerRoulette) { setInnerSpinning(true); window.setTimeout(() => setInnerSpinning(false), 4000); } window.dispatchEvent(new Event("zeon-profile-updated")); }, 5000);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка барабана."); setSpinning(false); }
  };
  return <main className="min-h-screen bg-[#05070d] text-white"><Header /><section className="px-3 pb-28 pt-4 sm:px-5 sm:pt-6"><div className="mx-auto max-w-[1440px] overflow-hidden rounded-[30px] border border-white/10 bg-[#070b11]"><div className="border-b border-white/10 px-4 py-4"><RecentDropsStrip title="Последние дропы" /></div><div className="px-3 py-7 sm:px-8 sm:py-9"><div className="mx-auto max-w-6xl"><div className="mb-7 text-center"><p className="text-xs font-semibold uppercase tracking-[.3em] text-violet-300">ZEONGGSTORE • БОНУСЫ</p><h1 className="mt-3 text-3xl font-black uppercase sm:text-5xl">Барабан фортуны</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">Один режим: круговой барабан. Сначала выбирается бонус, а если внутри него есть рандом — в центре появляется дополнительная рулетка.</p></div>
<div className="mb-6 rounded-[26px] border border-violet-300/20 bg-[#0a0f18] p-4 sm:p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Собери ZEONGG</h2><p className="mt-1 text-xs text-slate-500">Z → E → O → N → G → G. Два G — два отдельных слота.</p></div><span className="text-xs font-black text-violet-300">{letterState.collected.length}/6</span></div><div className="mt-4 grid grid-cols-6 gap-2">{LETTER_SLOTS.map((slot, i) => { const collected = letterState.collected.includes(slot); return <div key={slot} className={`rounded-2xl border p-2 text-center ${collected ? "border-violet-300/40 bg-violet-500/10" : "border-white/10 bg-black/20"}`}><div className={`mx-auto flex h-12 w-12 justify-center ${collected ? "opacity-100" : "opacity-20 grayscale"}`}><LetterSprite index={i} /></div><p className={`mt-1 text-xs font-black ${collected ? "text-violet-200" : "text-slate-600"}`}>{LETTER_LABELS[i]}</p></div>; })}</div>{letterState.completed && <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-center text-sm font-black text-emerald-200">🎉 ZEONGG собрано! Награда 50–500 Z-Coin начислена.</div>}</div>
<div className="rounded-[30px] border border-violet-400/20 bg-[#0a0f18] p-3 shadow-[0_18px_80px_rgba(76,29,149,.16)] sm:p-6"><div className="mb-4 flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-[.22em] text-slate-500"><span>Круговой барабан</span><span>Серверный результат</span></div><div className="relative mx-auto aspect-square w-full max-w-[620px]"><div className="absolute inset-0 rounded-full bg-violet-500/10 blur-3xl" /><div className="absolute inset-[3%] rounded-full border-[10px] border-[#1b1230] shadow-[0_0_70px_rgba(124,58,237,.28),inset_0_0_45px_rgba(0,0,0,.8)]" /><div className="absolute inset-[6%] overflow-hidden rounded-full border border-violet-300/25 shadow-[inset_0_0_55px_rgba(0,0,0,.8)]" style={{ background, transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 5s cubic-bezier(.12,.72,.17,1)" : "transform .3s ease" }}>{wheel.map((item, i) => { const angle = i * sectorAngle + sectorAngle / 2; return <div key={item.type} className="absolute left-1/2 top-1/2 flex h-[45%] w-[28%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={{ transform: `rotate(${angle}deg) translateY(-76%) rotate(${-angle}deg)` }}><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-black/25 text-xs font-black shadow-lg sm:h-14 sm:w-14 sm:text-sm">{item.icon}</div><span className="mt-2 max-w-[110px] text-[9px] font-black uppercase leading-3 drop-shadow sm:text-[10px]">{item.label}</span></div>; })}<div className="absolute inset-[31%] rounded-full border-2 border-violet-200/25 bg-[#090d15]/90 shadow-[0_0_40px_rgba(0,0,0,.7)]" /></div><div className="pointer-events-none absolute left-1/2 top-[2%] z-50 -translate-x-1/2"><div className="h-0 w-0 border-l-[17px] border-r-[17px] border-t-[30px] border-l-transparent border-r-transparent border-t-violet-100 drop-shadow-[0_0_12px_rgba(196,181,253,.9)]" /></div>{result?.innerRoulette && <InnerRoulette data={result.innerRoulette} spinning={innerSpinning} />}{result && !result.innerRoulette && !innerSpinning && <div className="absolute left-1/2 top-1/2 z-30 w-[48%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-violet-300/25 bg-[#090d15]/95 p-4 text-center shadow-[0_20px_70px_rgba(0,0,0,.65)] backdrop-blur-xl"><p className="text-[9px] font-black uppercase tracking-[.2em] text-violet-300">Результат</p><p className="mt-2 text-sm font-black sm:text-base">{result.label}</p></div>}</div><div className="mt-6 flex flex-col items-center gap-3"><button disabled={spinning || innerSpinning} onClick={() => void spin()} className="w-full max-w-sm rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 py-4 text-sm font-black uppercase tracking-wide shadow-[0_10px_35px_rgba(124,58,237,.28)] transition hover:brightness-110 disabled:opacity-50">{spinning ? "Барабан вращается..." : innerSpinning ? "Выбираем плюшку..." : "Крутить барабан"}</button><button onClick={() => setInfo((v) => !v)} className="text-xs font-bold text-violet-300">? Как работает барабан</button>{error && <p className="text-center text-xs font-bold text-red-300">{error}</p>}{info && <div className="mt-2 w-full max-w-2xl rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-slate-400"><p className="font-black text-white">Схема</p><p className="mt-1">Большой круг выбирает один из 8 бонусов. Если бонус содержит случайный результат, большой круг сначала полностью останавливается, после чего в его центре запускается горизонтальная рулетка — как в открытии кейса. Внешние сектора при этом остаются видны.</p></div>}</div></div>
<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{wheel.map((item) => <div key={item.type} className="rounded-2xl border border-white/10 bg-[#0a0f18] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-xs font-black text-violet-200">{item.icon}</div><div><p className="text-xs font-black">{item.label}</p><p className="text-[10px] text-slate-500">Вес {item.weight}</p></div></div><p className="mt-3 text-[11px] leading-4 text-slate-500">{descriptions[item.type]}</p></div>)}</div></div></div></div></section></main>;
}

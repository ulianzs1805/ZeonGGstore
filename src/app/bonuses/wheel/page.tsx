"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";
import TransparentImage from "@/app/components/TransparentImage";

type WheelItem = { type: string; label: string; icon: string; weight: number };
type LetterState = { collected: string[]; completed: boolean };
type InnerItem = { key: string; title: string; subtitle?: string; image?: string; icon?: string };
type InnerRouletteData = { items: InnerItem[]; selectedIndex: number; title: string };
type Result = { rewardType: string; rewardValue: number | null; caseId: string | null; label: string; sectorIndex: number; metadata?: { letter?: string; slotId?: string; [key: string]: unknown }; innerRoulette?: InnerRouletteData | null; letterState?: LetterState };

const letterImages: Record<string, string> = { Z: "/bonuses/letter_Z.png", E: "/bonuses/letter_E.png", O: "/bonuses/letter_O.png", N: "/bonuses/letter_N.png", G1: "/bonuses/letter_G1.png", G2: "/bonuses/letter_G2.png" };
const bonusImages: Record<string, string> = { FREE_CASE: "/bonuses/IMG_9358.jpeg", ZCOIN_RAIN: "/bonuses/IMG_9359.jpeg", Z_BOOST: "/bonuses/IMG_9360.jpeg", LUCKY_DROP: "/bonuses/IMG_9361.jpeg", SAFE_OPEN: "/bonuses/IMG_9363.jpeg", DEPOSIT_BONUS: "/bonuses/IMG_9364.jpeg", DOUBLE_DROP: "/bonuses/IMG_9365.jpeg" };
const fallbackWheel: WheelItem[] = [
  { type: "ZEON_SECRET", label: "ZEONGG Secret", icon: "Z", weight: 10 }, { type: "DEPOSIT_BONUS", label: "Депозит +5–35%", icon: "%", weight: 12 }, { type: "FREE_CASE", label: "Бесплатный кейс", icon: "▣", weight: 17 }, { type: "ZCOIN_RAIN", label: "Z-Coin Rain", icon: "Z¢", weight: 16 }, { type: "Z_BOOST", label: "+25% к следующей награде", icon: "+25%", weight: 13 }, { type: "LUCKY_DROP", label: "Lucky Drop", icon: "✦", weight: 11 }, { type: "SAFE_OPEN", label: "Safe Open", icon: "◉", weight: 9 }, { type: "DOUBLE_DROP", label: "Double Drop", icon: "2×", weight: 12 },
];
const descriptions: Record<string, string> = { ZEON_SECRET: "Случайная недостающая буква ZEONGG.", DEPOSIT_BONUS: "В центре выбирается бонус от 5% до 35%.", FREE_CASE: "Бесплатное открытие активного кейса.", ZCOIN_RAIN: "В центре выбирается пачка Z-Coin.", Z_BOOST: "Следующая подходящая награда получает +25% Z-Coin.", LUCKY_DROP: "Бонус для следующего открытия.", SAFE_OPEN: "Защита следующего открытия от слабого варианта.", DOUBLE_DROP: "Следующее открытие может дать дополнительный дроп." };
const innerTypes = ["DEPOSIT_BONUS", "ZCOIN_RAIN", "ZEON_SECRET", "FREE_CASE"];

function Letter({ id, collected }: { id: string; collected: boolean }) {
  return <div className={`relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border ${collected ? "border-orange-300/60 bg-orange-400/10" : "border-white/10 bg-black/25"}`}>
    {letterImages[id] && <img src={letterImages[id]} alt={id} className={`h-full w-full object-contain p-1 ${collected ? "" : "grayscale brightness-[.25]"}`} />}
    {!collected && <span className="absolute text-sm font-black text-white/20">?</span>}
  </div>;
}

function BonusVisual({ type, letter, large = false }: { type: string; letter?: string; large?: boolean }) {
  const image = type === "ZEON_SECRET" ? letterImages[letter ?? "Z"] : bonusImages[type];
  if (image) return <TransparentImage src={image} alt={type} className={`${large ? "h-28 w-28 sm:h-36 sm:w-36" : "h-14 w-14"} object-contain drop-shadow-[0_0_24px_rgba(251,146,60,.3)]`} />;
  return null;
}

function InnerCell({ item }: { item: InnerItem }) {
  if (item.image) return <TransparentImage src={item.image} alt={item.title} className="h-12 w-12 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,.8)]" />;
  const text = item.title.startsWith("+") ? item.title : item.icon ?? item.title;
  return <div className="grid h-12 w-12 place-items-center rounded-xl border border-orange-300/20 bg-orange-400/5"><span className="text-lg font-black text-orange-200">{text}</span></div>;
}

function InnerRoulette({ data, spinning }: { data: InnerRouletteData; spinning: boolean }) {
  const items = Array.from({ length: 9 }, () => data.items).flat();
  const target = data.selectedIndex + data.items.length * 4;
  const card = 112;
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); if (!spinning) return; const frame = window.requestAnimationFrame(() => setOffset(target)); return () => window.cancelAnimationFrame(frame); }, [data.selectedIndex, data.items.length, target, spinning]);
  return <div className="absolute inset-x-[4%] top-1/2 z-[80] -translate-y-1/2 rounded-[26px] border border-orange-300/30 bg-[#080a0f]/[.98] p-3 shadow-[0_30px_100px_rgba(0,0,0,.98)] backdrop-blur-md sm:inset-x-[7%] sm:p-4">
    <div className="mb-2 flex items-center justify-between px-1"><span className="text-[8px] font-black uppercase tracking-[.22em] text-slate-500">Финальный выбор</span><span className="text-[9px] font-black uppercase tracking-[.18em] text-orange-300">{data.title}</span></div>
    <div className="relative overflow-hidden rounded-2xl border border-orange-300/15 bg-[#020409] py-3 shadow-[inset_0_0_35px_rgba(0,0,0,.9)]">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-[3px] -translate-x-1/2 bg-orange-300 shadow-[0_0_22px_rgba(251,146,60,.95)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-1/4 bg-gradient-to-r from-[#020409] to-transparent" /><div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-1/4 bg-gradient-to-l from-[#020409] to-transparent" />
      <div className="flex w-max gap-2" style={{ transform: `translateX(calc(50% - ${card / 2}px - ${offset * (card + 8)}px))`, transition: spinning ? "transform 4.25s cubic-bezier(.08,.72,.12,1)" : "transform .3s ease-out" }}>
        {items.map((item, index) => <div key={`${item.key}-${index}`} className="flex h-[96px] w-[112px] shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#11151d] px-2 text-center"><InnerCell item={item} /><b className="mt-1 line-clamp-2 text-[9px] leading-3 text-white">{item.title}</b>{item.subtitle && <small className="mt-0.5 text-[7px] text-slate-500">{item.subtitle}</small>}</div>)}
      </div>
    </div>
  </div>;
}

function DrumCell({ item, index, angle, selected, letter }: { item: WheelItem; index: number; angle: number; selected: boolean; letter?: string }) {
  const image = item.type === "ZEON_SECRET" ? letterImages[letter ?? "Z"] : bonusImages[item.type];
  const mid = index * angle + angle / 2;
  return <div className="absolute left-1/2 top-1/2 h-[29%] w-[29%] -translate-x-1/2 -translate-y-1/2" style={{ transform: `rotate(${mid}deg) translateY(-135%)` }}>
    <div className={`relative h-full w-full rounded-full border-[5px] bg-[radial-gradient(circle_at_35%_28%,#252b38,#0d1017_58%,#050608)] shadow-[inset_0_0_25px_rgba(0,0,0,.95),0_8px_25px_rgba(0,0,0,.7)] sm:border-[7px] ${selected ? "border-orange-300 shadow-[0_0_42px_rgba(251,146,60,.82),inset_0_0_30px_rgba(251,146,60,.18)]" : "border-[#343a48]"}`}>
      <div className="absolute inset-[8%] rounded-full border border-white/[.09]" /><div className="absolute inset-[17%] grid place-items-center overflow-hidden rounded-full bg-[#07090d] shadow-[inset_0_0_22px_rgba(0,0,0,.9)]">{image && <TransparentImage src={image} alt={item.label} className="h-full w-full rounded-full object-contain drop-shadow-[0_0_12px_rgba(255,160,70,.55)]" />}</div>
      <div className="absolute bottom-[7%] left-1/2 w-[88%] -translate-x-1/2 text-center text-[7px] font-black uppercase leading-3 text-white/80 sm:text-[8px]">{item.label}</div>
      {selected && <div className="absolute inset-[5%] rounded-full border border-orange-300/60 animate-pulse" />}
    </div>
  </div>;
}

function RewardModal({ result, wheel, letter, onClose }: { result: Result; wheel: WheelItem[]; letter?: string; onClose: () => void }) {
  const item = wheel[result.sectorIndex] ?? wheel.find((entry) => entry.type === result.rewardType);
  const title = result.rewardType === "DEPOSIT_BONUS" && result.rewardValue != null ? `+${result.rewardValue}% к пополнению` : result.label || item?.label || "Бонус";
  return <div className="absolute inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur-[4px]">
    <div className="w-full max-w-[390px] overflow-hidden rounded-[30px] border border-orange-300/30 bg-[radial-gradient(circle_at_50%_0%,rgba(251,146,60,.17),transparent_52%),#080a0f] p-5 text-center shadow-[0_35px_120px_rgba(0,0,0,.9),0_0_55px_rgba(251,146,60,.12)] sm:p-7">
      <div className="mx-auto inline-flex rounded-full border border-orange-300/20 bg-orange-400/5 px-3 py-1 text-[8px] font-black uppercase tracking-[.25em] text-orange-200">Бонус получен</div>
      <div className="mx-auto mt-5 grid h-36 w-36 place-items-center rounded-full border border-orange-300/25 bg-[#05070b] shadow-[inset_0_0_35px_rgba(0,0,0,.9),0_0_45px_rgba(251,146,60,.18)]"><BonusVisual type={result.rewardType} letter={letter} large /></div>
      <div className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-slate-500">Вам выпало</div>
      <h3 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-[300px] text-xs leading-5 text-slate-400">{descriptions[result.rewardType] || "Бонус успешно получен."}</p>
      <div className="mt-5 rounded-2xl border border-orange-300/15 bg-orange-400/5 px-4 py-3 text-[10px] font-bold text-orange-200">Награда добавлена в ваш профиль</div>
      <button type="button" onClick={onClose} className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[.04] py-3 text-[10px] font-black uppercase tracking-[.18em] text-white transition hover:bg-white/[.08]">Продолжить</button>
    </div>
  </div>;
}

export default function FortuneWheelPage() {
  const [wheel, setWheel] = useState(fallbackWheel);
  const [letterState, setLetterState] = useState<LetterState>({ collected: [], completed: false });
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [innerSpinning, setInnerSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [rollingLetter, setRollingLetter] = useState<string | undefined>();
  const [showReward, setShowReward] = useState(false);
  const [error, setError] = useState("");
  const timers = useRef<number[]>([]);

  useEffect(() => { fetch("/api/bonuses/fortune", { cache: "no-store" }).then(async (response) => { if (!response.ok) return; const data = await response.json(); if (Array.isArray(data.wheel)) setWheel(data.wheel); if (data.letterState) setLetterState(data.letterState); }).catch(() => undefined); return () => timers.current.forEach((id) => window.clearTimeout(id)); }, []);
  const angle = 360 / Math.max(wheel.length, 1);
  const background = useMemo(() => `conic-gradient(from -22.5deg, ${wheel.map((_, i) => `${i % 2 ? "#151922" : "#202633"} ${i * angle}deg ${(i + 1) * angle}deg`).join(",")})`, [wheel, angle]);

  async function spin() {
    if (spinning || innerSpinning || showReward || !wheel.length) return;
    setSpinning(true); setInnerSpinning(false); setResult(null); setShowReward(false); setError("");
    const missingLetters = ["Z", "E", "O", "N", "G1", "G2"].filter((id) => !letterState.collected.includes(id));
    setRollingLetter(missingLetters.length ? missingLetters[Math.floor(Math.random() * missingLetters.length)] : undefined);
    try {
      const response = await fetch("/api/bonuses/fortune", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      const data: Result = await response.json();
      if (!response.ok) throw new Error((data as unknown as { error?: string }).error || "Не удалось прокрутить барабан");
      if (data.metadata?.letter) setRollingLetter(data.metadata.letter);
      const index = Number.isInteger(data.sectorIndex) ? data.sectorIndex : 0;
      setRotation((current) => current - 360 * 7 - (index + 0.5) * angle);
      const outer = window.setTimeout(() => {
        setSpinning(false); setResult(data); setRollingLetter(data.metadata?.letter); if (data.letterState) setLetterState(data.letterState); window.dispatchEvent(new Event("zeon-profile-updated"));
        if (data.innerRoulette && innerTypes.includes(data.rewardType)) { setInnerSpinning(true); const inner = window.setTimeout(() => { setInnerSpinning(false); setShowReward(true); }, 4400); timers.current.push(inner); } else setShowReward(true);
      }, 7250);
      timers.current.push(outer);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка барабана"); setSpinning(false); setRollingLetter(undefined); }
  }

  const selectedIndex = result ? (Number.isInteger(result.sectorIndex) ? result.sectorIndex : wheel.findIndex((item) => item.type === result.rewardType)) : -1;
  const resultLetter = result?.metadata?.letter ?? rollingLetter;
  const showInnerRoulette = Boolean(result?.innerRoulette && innerTypes.includes(result.rewardType));
  const letterIds = ["Z", "E", "O", "N", "G1", "G2"];

  return <main className="min-h-screen overflow-hidden bg-[#030407] text-white">
    <Header />
    <section className="px-3 pb-24 pt-3 sm:px-5 sm:pt-5">
      <div className="mx-auto max-w-[1500px] overflow-hidden rounded-[30px] border border-white/10 bg-[#080a0f] shadow-[0_35px_130px_rgba(0,0,0,.7)]">
        <div className="border-b border-white/10 bg-[#090b10] px-4 py-3 sm:px-6"><RecentDropsStrip title="Последние дропы" /></div>
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_50%_-20%,rgba(124,58,237,.24),transparent_60%)] px-4 py-8 text-center sm:px-8 sm:py-9">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.24em] text-orange-200"><span className="h-1.5 w-1.5 rounded-full bg-orange-300 shadow-[0_0_12px_rgba(251,146,60,.95)]" /> ZEONGG • Барабан</div>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[-.05em] sm:text-5xl">Барабан бонусов</h1>
          <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">Крути барабан, дождись финального выбора и сразу увидишь, какой бонус получил.</p>
        </div>
        <div className="grid gap-6 p-3 sm:p-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:p-8">
          <div className="rounded-[32px] border border-white/10 bg-[#090b10] p-3 shadow-[0_25px_90px_rgba(0,0,0,.6)] sm:p-6">
            <div className="mb-4 flex items-center justify-between px-1"><div><div className="text-[8px] font-black uppercase tracking-[.25em] text-slate-600">Главный призовой механизм</div><div className="mt-1 text-sm font-black">Крути и забирай бонус</div></div><div className="rounded-full border border-emerald-300/10 bg-emerald-400/5 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-300">SERVER ROLL</div></div>
            <div className="relative mx-auto aspect-square w-full max-w-[680px] overflow-hidden rounded-full border-[10px] border-[#11151d] bg-[#050609] p-3 shadow-[0_0_0_1px_rgba(255,255,255,.06),0_0_90px_rgba(0,0,0,.85)] sm:p-5">
              <div className="absolute inset-0 rounded-full" style={{ background }} /><div className="absolute inset-[2%] rounded-full border border-white/10" /><div className="absolute inset-[7%] rounded-full border border-orange-300/10" /><div className="absolute inset-[12%] rounded-full border border-white/[.04]" />
              <div className="absolute inset-[50%] z-20 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-orange-300/45 bg-[#0b0d12] shadow-[0_0_50px_rgba(251,146,60,.22),inset_0_0_30px_rgba(0,0,0,.95)]" /><div className="absolute inset-[50%] z-30 h-[5%] w-[5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-300 shadow-[0_0_28px_rgba(251,146,60,.95)]" />
              <div className="absolute left-1/2 top-[-.5%] z-50 h-0 w-0 -translate-x-1/2 border-l-[15px] border-r-[15px] border-t-[31px] border-l-transparent border-r-transparent border-t-orange-300 drop-shadow-[0_0_14px_rgba(251,146,60,.9)]" />
              <div className="absolute inset-[5%] transition-transform duration-[7.2s] ease-[cubic-bezier(.22,.61,.36,1)]" style={{ transform: `rotate(${rotation}deg)` }}>{wheel.map((item, index) => <DrumCell key={`${item.type}-${index}`} item={item} index={index} angle={angle} selected={selectedIndex === index} letter={item.type === "ZEON_SECRET" ? resultLetter : undefined} />)}</div>
              <button type="button" onClick={spin} disabled={spinning || innerSpinning || showReward} className="absolute inset-[41%] z-[60] rounded-full border-2 border-orange-300/55 bg-[radial-gradient(circle_at_35%_25%,#1d222d,#090b10)] text-[10px] font-black uppercase tracking-[.18em] text-orange-100 shadow-[0_0_40px_rgba(251,146,60,.25),inset_0_0_20px_rgba(0,0,0,.8)] transition hover:scale-105 hover:border-orange-200 disabled:cursor-not-allowed disabled:opacity-60">{spinning ? "Крутим" : innerSpinning ? "Дроп" : "Крутить"}</button>
              {showInnerRoulette && result?.innerRoulette && <InnerRoulette data={result.innerRoulette} spinning={innerSpinning} />}
              {showReward && result && <RewardModal result={result} wheel={wheel} letter={resultLetter} onClose={() => { setShowReward(false); setResult(null); setRollingLetter(undefined); }} />}
            </div>
          </div>
          <aside className="rounded-[32px] border border-white/10 bg-[#090b10] p-5"><div className="text-[8px] font-black uppercase tracking-[.25em] text-slate-600">Бонусы</div><h2 className="mt-2 text-xl font-black">Что может выпасть</h2><div className="mt-4 space-y-2">{wheel.map((item) => <div key={item.type} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.02] p-3"><div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-orange-300/20 bg-[#07090d]"><BonusVisual type={item.type} letter={item.type === "ZEON_SECRET" ? "Z" : undefined} /></div><div className="min-w-0"><div className="truncate text-[10px] font-black uppercase text-white">{item.label}</div><div className="mt-1 text-[9px] leading-4 text-slate-500">{descriptions[item.type] || "Бонус барабана."}</div></div></div>)}</div><div className="mt-5 border-t border-white/10 pt-4"><div className="text-[8px] font-black uppercase tracking-[.2em] text-slate-600">ZEONGG letters</div><div className="mt-3 flex flex-wrap gap-2">{letterIds.map((id) => <Letter key={id} id={id} collected={letterState.collected.includes(id)} />)}</div></div>{error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-200">{error}</div>}</aside>
        </div>
      </div>
    </section>
  </main>;
}

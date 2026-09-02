"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";

type WheelItem = { type: string; label: string; icon: string; weight: number };
type LetterState = { collected: string[]; completed: boolean };
type InnerItem = { key: string; title: string; subtitle?: string; image?: string; icon?: string };
type InnerRouletteData = { items: InnerItem[]; selectedIndex: number; title: string };
type Result = { rewardType: string; rewardValue: number | null; caseId: string | null; label: string; sectorIndex: number; metadata?: { letter?: string; slotId?: string; [key: string]: unknown }; innerRoulette?: InnerRouletteData | null; letterState?: LetterState };

const letterImages: Record<string, string> = {
  Z: "/bonuses/letter_Z.png",
  E: "/bonuses/letter_E.png",
  O: "/bonuses/letter_O.png",
  N: "/bonuses/letter_N.png",
  G1: "/bonuses/letter_G1.png",
  G2: "/bonuses/letter_G2.png",
};

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
  ZEON_SECRET: "Случайная недостающая буква ZEONGG. После полного слова — 50–500 Z-Coin.",
  DEPOSIT_BONUS: "В центре выбирается бонус 5–35%.",
  FREE_CASE: "Бесплатное открытие активного кейса без списания Z-Coin.",
  ZCOIN_RAIN: "В центре рулетка выбирает пачку Z-Coin.",
  Z_BOOST: "Следующая подходящая награда получает +25% Z-Coin.",
  LUCKY_DROP: "Бонус для следующего открытия с шансом на более редкий дроп.",
  SAFE_OPEN: "Защита следующего открытия от самого слабого варианта.",
  DOUBLE_DROP: "Следующее подходящее открытие может дать дополнительный дроп.",
};

function Letter({ id, collected }: { id: string; collected: boolean }) {
  return <div className={`relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border ${collected ? "border-orange-300/60 bg-orange-400/10" : "border-white/10 bg-black/25"}`}>
    {letterImages[id] && <img src={letterImages[id]} alt={id} className={`h-full w-full object-contain p-1 ${collected ? "" : "grayscale brightness-[.25]"}`} />}
    {!collected && <span className="absolute text-sm font-black text-white/20">?</span>}
  </div>;
}

function InnerRoulette({ data, spinning }: { data: InnerRouletteData; spinning: boolean }) {
  const items = Array.from({ length: 9 }, () => data.items).flat();
  const target = data.selectedIndex + data.items.length * 4;
  const card = 116;
  return <div className="absolute inset-x-[4%] top-1/2 z-50 -translate-y-1/2 rounded-[24px] border border-orange-300/25 bg-[#070910]/[.98] p-3 shadow-[0_30px_100px_rgba(0,0,0,.95)] backdrop-blur-xl sm:inset-x-[7%] sm:p-4">
    <div className="mb-2 flex items-center justify-between px-1 text-[8px] font-black uppercase tracking-[.2em]"><span className="text-slate-500">Финальный дроп</span><span className="text-orange-300">{data.title}</span></div>
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#020409] py-3">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-[3px] -translate-x-1/2 bg-orange-300 shadow-[0_0_22px_rgba(251,146,60,.95)]" />
      <div className="flex w-max gap-2" style={{ transform: `translateX(calc(50% - ${card / 2}px - ${target * (card + 8)}px))`, transition: spinning ? "transform 4.25s cubic-bezier(.08,.72,.12,1)" : "transform .3s ease-out" }}>
        {items.map((item, i) => <div key={`${item.key}-${i}`} className="flex h-[104px] w-[116px] shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#11151d] px-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-orange-300/15 bg-orange-400/5 text-[10px] font-black text-orange-200">{item.image ? <img src={item.image} alt="" className="h-full w-full object-contain" /> : item.icon ?? "✦"}</div>
          <b className="mt-2 line-clamp-2 text-[9px] leading-3 text-white">{item.title}</b>{item.subtitle && <small className="mt-0.5 text-[7px] text-slate-500">{item.subtitle}</small>}
        </div>)}
      </div>
    </div>
  </div>;
}

function DrumCell({ item, index, angle, selected, letter }: { item: WheelItem; index: number; angle: number; selected: boolean; letter?: string }) {
  const mid = index * angle + angle / 2;
  const isLetter = item.type === "ZEON_SECRET";
  const image = isLetter && letter ? letterImages[letter] : undefined;
  return <div className="absolute left-1/2 top-1/2 h-[25%] w-[25%] -translate-x-1/2 -translate-y-1/2" style={{ transform: `rotate(${mid}deg) translateY(-151%)` }}>
    <div className={`relative h-full w-full rounded-full border-[6px] bg-[radial-gradient(circle_at_35%_30%,#202632,#090b10_62%,#050608)] shadow-[inset_0_0_22px_rgba(0,0,0,.95),0_8px_25px_rgba(0,0,0,.65)] transition-all duration-300 sm:border-[8px] ${selected ? "border-orange-300 shadow-[0_0_38px_rgba(251,146,60,.75),inset_0_0_30px_rgba(251,146,60,.14)]" : "border-[#292e39]"}`}>
      <div className="absolute inset-[9%] rounded-full border border-white/[.08]" />
      <div className="absolute inset-[17%] grid place-items-center overflow-hidden rounded-full bg-[#07090d] shadow-[inset_0_0_22px_rgba(0,0,0,.9)]">
        {image ? <img src={image} alt={letter} className="h-[68%] w-[68%] object-contain drop-shadow-[0_0_12px_rgba(255,160,70,.45)]" /> : <span className="text-[10px] font-black uppercase tracking-[.08em] text-slate-700 sm:text-xs">{isLetter ? "?" : ""}</span>}
      </div>
      {selected && <div className="absolute inset-[6%] rounded-full border border-orange-300/50 animate-pulse" />}
    </div>
    <div className="pointer-events-none absolute left-1/2 top-[111%] w-[175%] -translate-x-1/2 text-center" style={{ transform: `translateX(-50%) rotate(${-mid}deg)` }}>
      <span className={`text-[7px] font-black uppercase leading-3 drop-shadow-[0_2px_8px_rgba(0,0,0,.95)] sm:text-[9px] ${selected ? "text-orange-100" : "text-slate-300"}`}>{item.label}</span>
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
  const [error, setError] = useState("");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    fetch("/api/bonuses/fortune", { cache: "no-store" }).then(async (r) => { if (!r.ok) return; const data = await r.json(); if (Array.isArray(data.wheel)) setWheel(data.wheel); if (data.letterState) setLetterState(data.letterState); }).catch(() => undefined);
    return () => timers.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const angle = 360 / Math.max(wheel.length, 1);
  const background = useMemo(() => `conic-gradient(from -22.5deg, ${wheel.map((_, i) => `${i % 2 ? "#11151d" : "#171b24"} ${i * angle}deg ${(i + 1) * angle}deg`).join(",")})`, [wheel, angle]);

  async function spin() {
    if (spinning || innerSpinning || !wheel.length) return;
    setSpinning(true); setResult(null); setError("");
    try {
      const r = await fetch("/api/bonuses/fortune", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      const data: Result = await r.json();
      if (!r.ok) throw new Error((data as unknown as { error?: string }).error || "Не удалось прокрутить барабан");
      const index = Number.isInteger(data.sectorIndex) ? data.sectorIndex : 0;
      setRotation((current) => current - 360 * 9 - (index + 0.5) * angle);
      const outer = window.setTimeout(() => {
        setSpinning(false); setResult(data); if (data.letterState) setLetterState(data.letterState); window.dispatchEvent(new Event("zeon-profile-updated"));
        if (data.innerRoulette) { setInnerSpinning(true); const inner = window.setTimeout(() => setInnerSpinning(false), 4400); timers.current.push(inner); }
      }, 5050);
      timers.current.push(outer);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка барабана"); setSpinning(false); }
  }

  const selected = result?.sectorIndex;
  const resultLetter = result?.metadata?.letter;
  const letterIds = ["Z", "E", "O", "N", "G1", "G2"];

  return <main className="min-h-screen overflow-hidden bg-[#030407] text-white">
    <Header />
    <section className="px-3 pb-24 pt-3 sm:px-5 sm:pt-5">
      <div className="mx-auto max-w-[1500px] overflow-hidden rounded-[30px] border border-white/10 bg-[#080a0f] shadow-[0_35px_130px_rgba(0,0,0,.7)]">
        <div className="border-b border-white/10 bg-[#090b10] px-4 py-3 sm:px-6"><RecentDropsStrip title="Последние дропы" /></div>
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_50%_-20%,rgba(124,58,237,.24),transparent_60%)] px-4 py-8 text-center sm:px-8 sm:py-9">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.24em] text-orange-200"><span className="h-1.5 w-1.5 rounded-full bg-orange-300 shadow-[0_0_12px_rgba(251,146,60,.95)]" /> ZEONGG • Барабан</div>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[-.05em] sm:text-5xl">Барабан бонусов</h1>
          <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">Один барабан. Сервер выбирает бонус по текущим приоритетам, а затем при необходимости запускает финальную рулетку.</p>
        </div>

        <div className="grid gap-6 p-3 sm:p-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:p-8">
          <div className="rounded-[32px] border border-white/10 bg-[#090b10] p-3 shadow-[0_25px_90px_rgba(0,0,0,.6)] sm:p-6">
            <div className="mb-4 flex items-center justify-between px-1"><div><div className="text-[8px] font-black uppercase tracking-[.25em] text-slate-600">Главный призовой механизм</div><div className="mt-1 text-sm font-black">Крути и забирай бонус</div></div><div className="rounded-full border border-emerald-300/10 bg-emerald-400/5 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-300">SERVER ROLL</div></div>
            <div className="relative mx-auto aspect-square w-full max-w-[720px]">
              <div className="absolute inset-0 rounded-full bg-violet-600/10 blur-3xl" />
              <div className="absolute inset-[1%] rounded-full border border-white/[.04] bg-[#05070a] shadow-[0_0_100px_rgba(0,0,0,.95)]" />
              <div className="absolute inset-[4%] rounded-full border-[12px] border-[#161a22] shadow-[0_0_0_2px_rgba(255,255,255,.04),0_25px_70px_rgba(0,0,0,.9),inset_0_0_45px_rgba(0,0,0,.95)] sm:border-[18px]" />
              <div className="absolute inset-[7%] rounded-full border border-white/10 bg-[#090c12] p-2 shadow-[inset_0_0_60px_rgba(0,0,0,.95)]">
                <div className="relative h-full w-full overflow-hidden rounded-full" style={{ transform: `rotate(${rotation}deg)`, transition: "transform 5s cubic-bezier(.08,.72,.12,1)", background }}>
                  <div className="absolute inset-[4%] rounded-full border border-white/[.07] shadow-[inset_0_0_45px_rgba(0,0,0,.8)]" />
                  {wheel.map((item, i) => <DrumCell key={item.type} item={item} index={i} angle={angle} selected={selected === i} letter={resultLetter} />)}
                  <div className="absolute inset-[28%] rounded-full border-[9px] border-[#171b23] bg-[#06080c] shadow-[inset_0_0_50px_rgba(0,0,0,.95),0_0_0_2px_rgba(255,255,255,.04)] sm:border-[13px]" />
                  <div className="absolute inset-[33%] rounded-full border border-white/10 bg-[radial-gradient(circle_at_45%_35%,#171b24,#07090d_68%)] shadow-[inset_0_0_35px_rgba(0,0,0,.95)]" />
                </div>
              </div>
              <div className="absolute left-1/2 top-[1.2%] z-[70] -translate-x-1/2"><div className="h-0 w-0 border-l-[18px] border-r-[18px] border-t-[30px] border-l-transparent border-r-transparent border-t-orange-300 drop-shadow-[0_0_18px_rgba(251,146,60,.85)] sm:border-l-[22px] sm:border-r-[22px] sm:border-t-[36px]" /></div>
              <div className="absolute left-1/2 top-1/2 z-[80] -translate-x-1/2 -translate-y-1/2">
                <button type="button" onClick={spin} disabled={spinning || innerSpinning} className="group relative flex h-28 w-28 flex-col items-center justify-center rounded-full border border-orange-200/40 bg-[#10131a] shadow-[0_0_0_7px_rgba(0,0,0,.72),0_0_55px_rgba(251,146,60,.2),inset_0_0_40px_rgba(0,0,0,.95)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70 sm:h-36 sm:w-36"><span className="absolute inset-2 rounded-full border border-orange-300/10" /><span className="text-[9px] font-black uppercase tracking-[.25em] text-orange-200">{spinning ? "Крутится" : innerSpinning ? "Дроп" : "Крутить"}</span><span className="mt-1 text-[8px] text-slate-500">{innerSpinning ? "финальная рулетка" : "барабан бонусов"}</span></button>
              </div>
              {result?.innerRoulette && <InnerRoulette data={result.innerRoulette} spinning={innerSpinning} />}
            </div>
            {error && <div className="mt-4 rounded-2xl border border-red-300/10 bg-red-400/5 px-4 py-3 text-center text-xs text-red-300">{error}</div>}
            {result && !innerSpinning && <div className="mt-5 rounded-2xl border border-orange-300/15 bg-orange-400/5 px-4 py-4 text-center"><div className="text-[8px] font-black uppercase tracking-[.25em] text-orange-300">Вам выпал бонус</div><div className="mt-1 text-lg font-black">{result.label}</div>{result.rewardValue !== null && <div className="mt-1 text-sm font-bold text-orange-200">{result.rewardValue}</div>}</div>}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-[#0a0c11] p-5"><div className="text-[9px] font-black uppercase tracking-[.25em] text-orange-300">Супербонус</div><h2 className="mt-2 text-xl font-black">Собери ZEONGG</h2><p className="mt-2 text-xs leading-5 text-slate-500">Из барабана выпадает только одна недостающая буква за раз.</p><div className="mt-4 flex gap-2">{letterIds.map((id) => <Letter key={id} id={id} collected={letterState.collected.includes(id)} />)}</div>{letterState.completed && <div className="mt-3 rounded-xl border border-orange-300/15 bg-orange-400/5 px-3 py-2 text-[9px] font-bold text-orange-200">Слово собрано — награда уже выдана.</div>}</div>
            <div className="rounded-[28px] border border-white/10 bg-[#0a0c11] p-5"><div className="text-[9px] font-black uppercase tracking-[.25em] text-slate-500">Бонусы барабана</div><div className="mt-3 space-y-2">{wheel.map((item) => <div key={item.type} className="rounded-xl border border-white/5 bg-white/[.02] p-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-400/10 text-[9px] font-black text-orange-200">{item.icon}</span><div className="min-w-0"><div className="text-[10px] font-black">{item.label}</div><div className="mt-0.5 text-[8px] leading-3 text-slate-600">{descriptions[item.type]}</div></div></div></div>)}</div></div>
          </aside>
        </div>
      </div>
    </section>
  </main>;
}

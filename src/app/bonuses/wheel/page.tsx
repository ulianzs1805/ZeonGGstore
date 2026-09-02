"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";

type WheelItem = { type: string; label: string; icon: string; weight: number };
type LetterState = { collected: string[]; completed: boolean };
type InnerItem = { key: string; title: string; subtitle?: string; image?: string; icon?: string };
type InnerRouletteData = { items: InnerItem[]; selectedIndex: number; title: string };
type Result = {
  rewardType: string;
  rewardValue: number | null;
  caseId: string | null;
  label: string;
  sectorIndex: number;
  metadata?: { letter?: string; slotId?: string; [key: string]: unknown };
  innerRoulette?: InnerRouletteData | null;
  letterState?: LetterState;
};

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

function Letter({ index, collected }: { index: number; collected: boolean }) {
  return (
    <div className={`relative h-11 w-11 overflow-hidden rounded-xl border ${collected ? "border-orange-300/50 bg-orange-400/10 shadow-[0_0_22px_rgba(251,146,60,.18)]" : "border-white/10 bg-black/25"}`}>
      <div className={`absolute inset-1 bg-contain bg-no-repeat ${collected ? "" : "grayscale brightness-[.28]"}`} style={{ backgroundImage: `url("${LETTER_IMAGE}")`, backgroundPosition: `${index * 20}% center` }} />
      {!collected && <span className="absolute inset-0 grid place-items-center text-sm font-black text-white/20">?</span>}
    </div>
  );
}

function InnerRoulette({ data, spinning }: { data: InnerRouletteData; spinning: boolean }) {
  const rounds = Array.from({ length: 8 }, () => data.items).flat();
  const target = data.selectedIndex + data.items.length * 4;
  const card = 118;
  return (
    <div className="absolute inset-x-[4%] top-1/2 z-30 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/15 bg-[#070910]/[.97] p-3 shadow-[0_25px_80px_rgba(0,0,0,.9)] backdrop-blur-xl sm:inset-x-[8%] sm:p-4">
      <div className="mb-2 flex items-center justify-between text-[8px] font-black uppercase tracking-[.2em]">
        <span className="text-slate-500">Внутренняя рулетка</span><span className="text-orange-300">{data.title}</span>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#03050a] py-2">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[3px] -translate-x-1/2 bg-orange-300 shadow-[0_0_18px_rgba(251,146,60,.95)]" />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-16 -translate-x-1/2 bg-orange-400/10 blur-xl" />
        <div className="flex w-max gap-2" style={{ transform: `translateX(calc(50% - ${card / 2}px - ${target * (card + 8)}px))`, transition: spinning ? "transform 4.1s cubic-bezier(.08,.72,.12,1)" : "transform .25s ease-out" }}>
          {rounds.map((item, i) => (
            <div key={`${item.key}-${i}`} className="flex h-20 w-[118px] shrink-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-[#11151d] px-2 text-center">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-violet-300/15 bg-violet-500/10 text-[10px] font-black text-orange-200">{item.image ? <img src={item.image} alt="" className="h-full w-full object-contain" /> : item.icon ?? "✦"}</div>
              <b className="mt-1 line-clamp-2 text-[9px] leading-3 text-white">{item.title}</b>
              {item.subtitle && <small className="text-[7px] text-slate-500">{item.subtitle}</small>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
    fetch("/api/bonuses/fortune", { cache: "no-store" }).then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data.wheel)) setWheel(data.wheel);
      if (data.letterState) setLetterState(data.letterState);
    }).catch(() => undefined);
    return () => timers.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const angle = 360 / Math.max(wheel.length, 1);
  const colors = ["#32175a", "#182b49", "#5a183e", "#153d45", "#4e301b", "#28194f", "#17433d", "#481b35"];
  const wheelBackground = useMemo(() => `conic-gradient(from 0deg, ${wheel.map((_, i) => `${colors[i % colors.length]} ${i * angle}deg ${(i + 1) * angle}deg`).join(",")})`, [wheel, angle]);

  async function spin() {
    if (spinning || innerSpinning) return;
    setSpinning(true); setResult(null); setError("");
    try {
      const r = await fetch("/api/bonuses/fortune", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      const data: Result = await r.json();
      if (!r.ok) throw new Error((data as unknown as { error?: string }).error || "Не удалось прокрутить барабан");
      const index = Number.isInteger(data.sectorIndex) ? data.sectorIndex : 0;
      // The sector CENTER, not its edge, is aligned with the fixed top pointer.
      setRotation((current) => current - 360 * 8 - (index + 0.5) * angle);
      const outer = window.setTimeout(() => {
        setSpinning(false); setResult(data);
        if (data.letterState) setLetterState(data.letterState);
        window.dispatchEvent(new Event("zeon-profile-updated"));
        if (data.innerRoulette) {
          setInnerSpinning(true);
          const inner = window.setTimeout(() => setInnerSpinning(false), 4250);
          timers.current.push(inner);
        }
      }, 5050);
      timers.current.push(outer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка барабана"); setSpinning(false);
    }
  }

  const selected = result?.sectorIndex;
  const letters = ["Z", "E", "O", "N", "G", "G"];

  return (
    <main className="min-h-screen overflow-hidden bg-[#050609] text-white">
      <Header />
      <section className="px-3 pb-24 pt-3 sm:px-5 sm:pt-5">
        <div className="mx-auto max-w-[1480px] overflow-hidden rounded-[30px] border border-white/10 bg-[#080a0f] shadow-[0_30px_120px_rgba(0,0,0,.5)]">
          <div className="border-b border-white/10 bg-[#0a0c11] px-4 py-3 sm:px-6"><RecentDropsStrip title="Последние дропы" /></div>

          <header className="border-b border-white/10 bg-[radial-gradient(circle_at_50%_-20%,rgba(124,58,237,.28),transparent_58%)] px-4 py-7 text-center sm:px-8 sm:py-9">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.22em] text-violet-300"><span className="h-1.5 w-1.5 rounded-full bg-orange-300 shadow-[0_0_10px_rgba(251,146,60,.9)]" /> ZEONGG BONUS SYSTEM</div>
            <h1 className="mt-3 text-3xl font-black uppercase tracking-[-.04em] sm:text-5xl">Барабан бонусов</h1>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">Один барабан — восемь бонусов. Если награда внутри случайная, она разыгрывается прямо в центре, как финальный дроп из кейса.</p>
          </header>

          <div className="grid gap-6 p-3 sm:p-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:p-8">
            <div className="rounded-[30px] border border-white/10 bg-[#0b0d12] p-3 shadow-[0_25px_90px_rgba(0,0,0,.55)] sm:p-6">
              <div className="mb-5 flex items-center justify-between px-1"><div><div className="text-[8px] font-black uppercase tracking-[.24em] text-slate-600">Главный призовой механизм</div><div className="mt-1 text-sm font-black">Крути и забирай бонус</div></div><div className="rounded-full border border-emerald-300/10 bg-emerald-400/5 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-300">SERVER ROLL</div></div>

              <div className="relative mx-auto aspect-square w-full max-w-[700px]">
                <div className="absolute inset-[2%] rounded-full bg-violet-600/10 blur-3xl" />
                <div className="absolute inset-[4%] rounded-full border-[10px] border-[#171922] bg-[#07090d] shadow-[0_0_0_2px_rgba(255,255,255,.04),0_35px_80px_rgba(0,0,0,.9),inset_0_0_45px_rgba(0,0,0,.9)] sm:border-[14px]" />
                <div className="absolute inset-[8%] rounded-full border border-white/10" />
                <div className="absolute inset-[9%] overflow-hidden rounded-full shadow-[inset_0_0_70px_rgba(0,0,0,.8)]" style={{ transform: `rotate(${rotation}deg)`, transition: "transform 5s cubic-bezier(.08,.72,.12,1)", background: wheelBackground }}>
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_0,transparent_52%,rgba(0,0,0,.25)_100%)]" />
                  {wheel.map((item, i) => {
                    const mid = i * angle + angle / 2;
                    return <div key={item.type} className="absolute left-1/2 top-1/2 h-[45%] w-[27%] -translate-x-1/2 -translate-y-1/2 text-center" style={{ transform: `rotate(${mid}deg) translateY(-74%) rotate(${-mid}deg)` }}><div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border text-[10px] font-black shadow-lg sm:h-14 sm:w-14 sm:text-xs ${selected === i ? "border-orange-200 bg-orange-400/25 text-orange-100 shadow-[0_0_30px_rgba(251,146,60,.5)]" : "border-white/15 bg-black/30 text-orange-200"}`}>{item.icon}</div><div className="mt-2 line-clamp-2 text-[7px] font-black uppercase leading-3 text-white/90 drop-shadow-[0_2px_5px_rgba(0,0,0,.9)] sm:text-[9px]">{item.label}</div></div>;
                  })}
                  {Array.from({ length: wheel.length }).map((_, i) => <div key={`line-${i}`} className="pointer-events-none absolute left-1/2 top-1/2 h-1/2 w-px origin-top bg-white/10" style={{ transform: `rotate(${i * angle}deg)` }} />)}
                  <div className="absolute inset-[31%] rounded-full border border-white/10 bg-[#080a10]/90 shadow-[inset_0_0_35px_rgba(0,0,0,.95)]" />
                </div>

                <div className="absolute left-1/2 top-[5%] z-40 -translate-x-1/2"><div className="h-0 w-0 border-l-[18px] border-r-[18px] border-t-[34px] border-l-transparent border-r-transparent border-t-orange-400 drop-shadow-[0_6px_8px_rgba(0,0,0,.9)]" /><div className="mx-auto -mt-[30px] h-2 w-2 rounded-full bg-white shadow-[0_0_12px_white]" /></div>
                <div className="absolute inset-[34%] z-20 grid place-items-center rounded-full"><div className="text-center"><div className="text-3xl font-black tracking-[-.12em] text-white drop-shadow-[0_0_20px_rgba(124,58,237,.4)]">Z<span className="text-orange-400">G</span></div><div className="mt-1 text-[7px] font-black uppercase tracking-[.2em] text-slate-500">{result ? result.label : "БАРАБАН"}</div></div></div>

                {result?.innerRoulette && <InnerRoulette data={result.innerRoulette} spinning={innerSpinning} />}

                <button onClick={spin} disabled={spinning || innerSpinning} className="absolute bottom-[5%] left-1/2 z-50 flex h-[92px] w-[92px] -translate-x-1/2 flex-col items-center justify-center rounded-full border border-orange-200/80 bg-[radial-gradient(circle_at_35%_30%,#ffc078,#ff791b_65%,#a33a09)] text-[#1c0d05] shadow-[0_16px_40px_rgba(0,0,0,.8),0_0_40px_rgba(251,146,60,.28)] transition-transform hover:scale-105 disabled:cursor-wait disabled:opacity-80 sm:h-[110px] sm:w-[110px]"><span className="text-[13px] font-black sm:text-[15px]">{spinning ? "КРУТИМ" : innerSpinning ? "ДРОП" : "КРУТИТЬ"}</span><span className="mt-0.5 text-[6px] font-black uppercase tracking-[.2em]">{spinning ? "ОЖИДАЙ" : "БАРАБАН"}</span></button>
              </div>
            </div>

            <aside className="rounded-[24px] border border-white/10 bg-[#0d0f16] p-4 shadow-[0_20px_60px_rgba(0,0,0,.4)]">
              <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3"><span className="text-[9px] font-black uppercase tracking-[.22em] text-slate-500">Награды барабана</span><b className="text-[10px] text-orange-300">8</b></div>
              <div className="space-y-1">
                {wheel.map((item, i) => <div key={item.type} className={`flex items-center gap-2 rounded-xl border p-2 transition ${selected === i ? "border-orange-300/30 bg-orange-400/10" : "border-transparent"}`}><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#151824] text-[10px] font-black text-orange-200">{item.icon}</div><div className="min-w-0 flex-1"><b className="block truncate text-[9px] text-white">{item.label}</b><span className="text-[7px] text-slate-600">Шанс по системе</span></div><strong className="text-[9px] text-slate-400">{item.weight}%</strong></div>)}
              </div>
              {result && <div className="mt-4 rounded-xl border border-orange-300/15 bg-orange-400/5 p-3"><div className="text-[7px] font-black uppercase tracking-[.2em] text-orange-300/70">Последний дроп</div><div className="mt-1 text-sm font-black">{result.label}</div>{result.rewardValue !== null && result.rewardValue !== undefined && <div className="mt-1 text-lg font-black text-orange-300">{result.rewardValue}</div>}</div>}
              {error && <div className="mt-3 rounded-xl border border-red-300/15 bg-red-400/5 p-3 text-[9px] font-bold text-red-300">{error}</div>}
            </aside>
          </div>

          <div className="border-t border-white/10 bg-[#090b10] px-4 py-5 sm:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="text-[8px] font-black uppercase tracking-[.25em] text-orange-300/70">SUPERBONUS</div><div className="mt-1 text-sm font-black">Собери слово ZEONGG</div><div className="mt-1 text-[9px] text-slate-600">Буквы выпадают из бонуса ZEONGG Secret и сохраняются по слотам.</div></div>
              <div className="flex gap-2">{letters.map((_, i) => <Letter key={i} index={i} collected={Boolean(letterState.collected?.includes(i === 4 ? "G1" : i === 5 ? "G2" : letters[i]))} />)}</div>
            </div>
          </div>

          <div className="px-4 py-4 text-center text-[8px] font-bold text-slate-700 sm:px-8">Результат выбирается сервером. Анимация барабана показывает уже определённую награду; внутренняя рулетка запускается только для бонусов со случайным содержимым.</div>
        </div>
      </section>
    </main>
  );
}

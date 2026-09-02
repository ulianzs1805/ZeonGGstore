"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";

type WheelItem = { type: string; label: string; icon: string; weight: number };
type LetterState = { collected: string[]; completed: boolean };
type InnerItem = { key: string; title: string; subtitle?: string; image?: string; icon?: string };
type Result = {
  rewardType: string;
  rewardValue: number | null;
  caseId: string | null;
  label: string;
  sectorIndex: number;
  metadata?: { letter?: string; slotId?: string; [key: string]: unknown };
  innerRoulette?: { items: InnerItem[]; selectedIndex: number; title: string } | null;
  letterState?: LetterState;
};

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
  DEPOSIT_BONUS: "В центре после остановки барабана выбирается бонус к пополнению от 5% до 35%.",
  FREE_CASE: "Бесплатное открытие активного кейса без списания Z-Coin.",
  ZCOIN_RAIN: "Внутренняя рулетка выбирает пачку Z-Coin.",
  Z_BOOST: "Следующая подходящая награда получает +25% Z-Coin.",
  LUCKY_DROP: "Улучшает шанс получить более редкий дроп при следующем открытии кейса.",
  SAFE_OPEN: "Защита следующего открытия от самого слабого варианта дропа.",
  DOUBLE_DROP: "Следующее подходящее открытие может дать дополнительный случайный дроп.",
};

function LetterSprite({ index }: { index: number }) {
  return (
    <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div
        className="h-full w-[600%] bg-contain bg-no-repeat"
        style={{ backgroundImage: `url(${LETTER_IMAGE})`, backgroundPosition: `${index * 20}% center` }}
      />
    </div>
  );
}

function InnerRoulette({ data, spinning }: { data: NonNullable<Result["innerRoulette"]>; spinning: boolean }) {
  const items = Array.from({ length: 7 }).flatMap((_, round) => data.items.map((item) => ({ ...item, round })));
  const selected = data.selectedIndex + data.items.length * 3;
  const itemWidth = 132;

  return (
    <div className="absolute inset-x-2 top-1/2 z-40 -translate-y-1/2 overflow-hidden rounded-[26px] border border-white/15 bg-[#090c12]/98 p-3 shadow-[0_25px_90px_rgba(0,0,0,.9)] backdrop-blur-xl sm:inset-x-7 sm:p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[9px] font-black uppercase tracking-[.22em] text-slate-500">Внутренний дроп</span>
        <span className="text-[10px] font-black uppercase tracking-[.12em] text-violet-300">{data.title}</span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#05070b] py-3">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-[4px] -translate-x-1/2 bg-white shadow-[0_0_22px_rgba(255,255,255,.85)]" />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-20 -translate-x-1/2 bg-violet-500/10 blur-xl" />
        <div
          className="flex w-max gap-2 px-2"
          style={{
            transform: `translateX(calc(50% - ${itemWidth / 2 + 8}px - ${selected * (itemWidth + 8)}px))`,
            transition: spinning ? "transform 4.1s cubic-bezier(.08,.7,.16,1)" : "transform .35s ease-out",
          }}
        >
          {items.map((item) => (
            <div key={`${item.round}-${item.key}`} className="flex h-[112px] w-[124px] shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#11151e] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-violet-300/20 bg-violet-500/10 text-xs font-black text-violet-100">
                {item.image ? <img src={item.image} alt="" className="h-full w-full object-contain" /> : item.icon ?? "✦"}
              </div>
              <p className="mt-2 line-clamp-2 text-[10px] font-black leading-4 text-white">{item.title}</p>
              {item.subtitle && <p className="mt-0.5 text-[8px] font-bold uppercase text-slate-500">{item.subtitle}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WheelSector({ item, index, angle, winner }: { item: WheelItem; index: number; angle: number; winner: boolean }) {
  return (
    <div
      className={`absolute left-1/2 top-1/2 flex h-[48%] w-[31%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center transition-all duration-300 ${winner ? "scale-110" : ""}`}
      style={{ transform: `rotate(${angle}deg) translateY(-77%) rotate(${-angle}deg)` }}
    >
      <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border text-[11px] font-black shadow-[0_8px_25px_rgba(0,0,0,.4)] sm:h-16 sm:w-16 sm:text-sm ${winner ? "border-white/80 bg-violet-500/35 shadow-[0_0_30px_rgba(167,139,250,.65)]" : "border-white/15 bg-[#090d14]/65"}`}>
        <span className="absolute inset-0 rounded-2xl bg-white/5" />
        <span className="relative z-10">{item.icon}</span>
        {winner && <span className="absolute -inset-1 rounded-[18px] border border-violet-200/40" />}
      </div>
      <span className={`mt-2 max-w-[112px] text-[8px] font-black uppercase leading-3 drop-shadow-[0_2px_4px_rgba(0,0,0,.9)] sm:text-[10px] ${winner ? "text-white" : "text-slate-200"}`}>
        {item.label}
      </span>
      <span className="mt-1 text-[7px] font-bold text-white/35">{index + 1}</span>
    </div>
  );
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
  const timerRef = useRef<number[]>([]);

  useEffect(() => {
    void fetch("/api/bonuses/fortune", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) {
          setWheel(data.wheel ?? fallbackWheel);
          setLetterState(data.letterState ?? { collected: [], completed: false });
        }
      })
      .catch(() => {});

    return () => timerRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const sectorAngle = 360 / Math.max(1, wheel.length);
  const background = useMemo(() => {
    const colors = ["#35155f", "#182b4b", "#5a173f", "#143b45", "#54301a", "#29164f", "#15423d", "#4a1a35"];
    const stops = wheel.map((_, index) => `${colors[index % colors.length]} ${index * sectorAngle}deg ${(index + 1) * sectorAngle}deg`);
    return `conic-gradient(from 0deg, ${stops.join(",")})`;
  }, [wheel, sectorAngle]);

  const spin = async () => {
    if (spinning || innerSpinning || !wheel.length) return;
    setSpinning(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch("/api/bonuses/fortune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось запустить барабан.");

      const index = Number.isInteger(data.sectorIndex) ? data.sectorIndex : 0;
      const target = rotation - 360 * 8 - (index + 0.5) * sectorAngle;
      setRotation(target);

      const outerTimer = window.setTimeout(() => {
        setSpinning(false);
        setResult(data);
        setLetterState(data.letterState ?? letterState);
        window.dispatchEvent(new Event("zeon-profile-updated"));

        if (data.innerRoulette) {
          setInnerSpinning(true);
          const innerTimer = window.setTimeout(() => setInnerSpinning(false), 4200);
          timerRef.current.push(innerTimer);
        }
      }, 5000);
      timerRef.current.push(outerTimer);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка барабана.");
      setSpinning(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050608] text-white selection:bg-violet-500/30">
      <Header />
      <section className="px-3 pb-28 pt-3 sm:px-5 sm:pt-5">
        <div className="mx-auto max-w-[1480px] overflow-hidden rounded-[28px] border border-white/10 bg-[#080a0f] shadow-[0_25px_100px_rgba(0,0,0,.45)]">
          <div className="border-b border-white/10 bg-[#0a0c11] px-4 py-3 sm:px-6">
            <RecentDropsStrip title="Последние дропы" />
          </div>

          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_50%_-30%,rgba(124,58,237,.22),transparent_55%)] px-4 py-7 sm:px-8 sm:py-9">
            <div className="mx-auto max-w-6xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-500/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.24em] text-violet-300">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,.9)]" />
                ZEONGG • Барабан бонусов
              </div>
              <h1 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-5xl">Барабан фортуны</h1>
              <p className="mx-auto mt-3 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
                Один режим. Большой барабан выбирает бонус, а если внутри есть случайная награда — она разыгрывается отдельной рулеткой прямо в центре.
              </p>
            </div>
          </div>

          <div className="grid gap-6 p-3 sm:p-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:p-8">
            <div className="min-w-0">
              <div className="rounded-[30px] border border-white/10 bg-[#0b0d12] p-3 shadow-[0_25px_90px_rgba(0,0,0,.5)] sm:p-6">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.25em] text-slate-600">Главный призовой механизм</p>
                    <p className="mt-1 text-sm font-black">Крути и забирай бонус</p>
                  </div>
                  <div className="rounded-full border border-emerald-300/10 bg-emerald-400/5 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-300">Server roll</div>
                </div>

                <div className="relative mx-auto aspect-square w-full max-w-[700px]">
                  <div className="absolute inset-[1%] rounded-full bg-violet-600/10 blur-3xl" />
                  <div className="absolute inset-[2%] rounded-full border border-white/5 bg-[#07090d] shadow-[0_0_100px_rgba(0,0,0,.9)]" />
                  <div className="absolute inset-[4%] rounded-full border-[8px] border-[#161922] shadow-[0_0_0_2px_rgba(255,255,255,.03),0_0_50px_rgba(0,0,0,.8),inset_0_0_45px_rgba(0,0,0,.9)] sm:border-[12px]" />

                  <div
                    className="absolute inset-[7%] overflow-hidden rounded-full border border-white/15 shadow-[inset_0_0_70px_rgba(0,0,0,.9)]"
                    style={{ background, transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 5s cubic-bezier(.08,.72,.15,1)" : "transform .35s ease-out" }}
                  >
                    <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,.05),transparent_30%,rgba(0,0,0,.3))]" />
                    <div className="pointer-events-none absolute inset-0 rounded-full" style={{ backgroundImage: `repeating-conic-gradient(from 0deg, transparent 0deg ${sectorAngle - 1}deg, rgba(255,255,255,.25) ${sectorAngle - 1}deg ${sectorAngle}deg)` }} />
                    {wheel.map((item, index) => (
                      <WheelSector
                        key={item.type}
                        item={item}
                        index={index}
                        angle={index * sectorAngle + sectorAngle / 2}
                        winner={Boolean(result && !spinning && result.sectorIndex === index)}
                      />
                    ))}
                    <div className="absolute inset-[29%] rounded-full border border-white/10 bg-[#080a0f]/90 shadow-[0_0_45px_rgba(0,0,0,.9),inset_0_0_30px_rgba(0,0,0,.8)]" />
                  </div>

                  <div className="pointer-events-none absolute left-1/2 top-[2.5%] z-50 -translate-x-1/2">
                    <div className="relative h-0 w-0 border-l-[18px] border-r-[18px] border-t-[34px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_0_12px_rgba(255,255,255,.75)] sm:border-l-[22px] sm:border-r-[22px] sm:border-t-[40px]">
                      <div className="absolute -left-[7px] -top-[35px] h-3 w-3 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,1)] sm:-left-[8px] sm:-top-[40px] sm:h-4 sm:w-4" />
                    </div>
                  </div>

                  <div className="absolute left-1/2 top-1/2 z-30 flex h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-[#272b38] bg-[#10131a] shadow-[0_0_0_2px_rgba(255,255,255,.04),0_10px_45px_rgba(0,0,0,.9),inset_0_0_35px_rgba(0,0,0,.85)] sm:border-[7px]">
                    <div className="flex h-[82%] w-[82%] items-center justify-center rounded-full border border-violet-200/20 bg-[radial-gradient(circle_at_35%_25%,rgba(167,139,250,.4),rgba(88,28,135,.75)_35%,#160b26_75%)] shadow-[inset_0_2px_8px_rgba(255,255,255,.12),0_0_30px_rgba(124,58,237,.3)]">
                      <span className="text-xl font-black italic tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.8)] sm:text-3xl">Z</span>
                    </div>
                  </div>

                  {result?.innerRoulette && <InnerRoulette data={result.innerRoulette} spinning={innerSpinning} />}

                  {result && !result.innerRoulette && !innerSpinning && (
                    <div className="absolute left-1/2 top-1/2 z-40 w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-violet-200/20 bg-[#090b11]/96 p-3 text-center shadow-[0_20px_70px_rgba(0,0,0,.8)] backdrop-blur-xl sm:p-4">
                      <p className="text-[8px] font-black uppercase tracking-[.22em] text-violet-300">Выпало</p>
                      <p className="mt-2 text-xs font-black leading-4 sm:text-sm">{result.label}</p>
                    </div>
                  )}
                </div>

                <div className="mx-auto mt-5 flex max-w-md flex-col items-center gap-2.5">
                  <button
                    disabled={spinning || innerSpinning}
                    onClick={() => void spin()}
                    className="group relative w-full overflow-hidden rounded-2xl border border-violet-300/20 bg-gradient-to-b from-violet-500 to-violet-700 px-7 py-4 text-xs font-black uppercase tracking-[.16em] text-white shadow-[0_12px_35px_rgba(124,58,237,.28)] transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="absolute inset-x-0 top-0 h-px bg-white/30" />
                    {spinning ? "Барабан вращается…" : innerSpinning ? "Выбираем награду…" : "Крутить барабан"}
                  </button>
                  <button onClick={() => setInfo((value) => !value)} className="text-[10px] font-bold text-slate-500 transition hover:text-violet-300">Как это работает?</button>
                  {error && <p className="text-center text-xs font-bold text-red-300">{error}</p>}
                  {info && (
                    <div className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-[10px] leading-5 text-slate-500">
                      <p className="font-black uppercase tracking-wider text-white">Механика</p>
                      <p className="mt-1">Результат большого барабана выбирается сервером. После остановки выбранный сектор подсвечивается. Для бонусов с внутренним рандомом запускается горизонтальная рулетка в центре — по тому же принципу, что и рулетка открытия кейса.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[24px] border border-violet-300/15 bg-[#0b0d12] p-4 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.2em] text-violet-300">Супербонус</p>
                    <h2 className="mt-1 text-lg font-black">Собери ZEONGG</h2>
                  </div>
                  <span className="text-xs font-black text-violet-300">{letterState.collected.length}/6</span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-slate-600">Собирай недостающие буквы. Два G — два отдельных слота.</p>
                <div className="mt-4 grid grid-cols-6 gap-1.5">
                  {LETTER_SLOTS.map((slot, index) => {
                    const collected = letterState.collected.includes(slot);
                    return (
                      <div key={slot} className={`rounded-xl border p-1.5 text-center ${collected ? "border-violet-300/30 bg-violet-500/10" : "border-white/10 bg-black/20"}`}>
                        <div className={`mx-auto flex justify-center ${collected ? "opacity-100" : "opacity-20 grayscale"}`}><LetterSprite index={index} /></div>
                        <p className={`mt-1 text-[9px] font-black ${collected ? "text-violet-200" : "text-slate-700"}`}>{LETTER_LABELS[index]}</p>
                      </div>
                    );
                  })}
                </div>
                {letterState.completed && <div className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-500/5 p-2.5 text-center text-[10px] font-black text-emerald-300">🎉 ZEONGG собрано — 50–500 Z-Coin начислено.</div>}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#0b0d12] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-black">Бонусы барабана</h2>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-[8px] font-black text-slate-500">8 ПРИЗОВ</span>
                </div>
                <div className="space-y-1.5">
                  {wheel.map((item, index) => (
                    <div key={item.type} className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${result && !spinning && result.sectorIndex === index ? "border-violet-300/30 bg-violet-500/10" : "border-white/5 bg-white/[.015]"}`}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#11151d] text-[10px] font-black text-violet-200">{item.icon}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-black">{item.label}</p>
                        <p className="mt-0.5 line-clamp-1 text-[8px] text-slate-600">{descriptions[item.type]}</p>
                      </div>
                      <span className="text-[8px] font-black text-slate-700">#{index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

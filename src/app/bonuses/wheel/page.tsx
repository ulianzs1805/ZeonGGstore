"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";

type CaseItem = { id: string; name: string; image: string; price: number };
type WheelItem = { type: string; label: string; icon: string; weight: number };
type LetterState = { collected: string[]; completed: boolean };
type Result = { rewardType: string; rewardValue: number | null; caseId: string | null; label: string; mode?: string; metadata?: Record<string, unknown>; letterState?: LetterState; sectorIndex?: number };
type Mode = "BONUS" | "CASE" | "DEPOSIT";

type DepositReward = { amount: number; label: string; weight: number };

const fallbackWheel: WheelItem[] = [
  { type: "ZEON_SECRET", label: "Zeon Secret", icon: "Z", weight: 10 },
  { type: "DEPOSIT_RANDOM_SKIN", label: "Скин за пополнение", icon: "◈", weight: 12 },
  { type: "FREE_CASE", label: "Бесплатный кейс", icon: "▣", weight: 17 },
  { type: "ZCOIN_RAIN", label: "Z-Coin Rain", icon: "Z¢", weight: 16 },
  { type: "Z_BOOST", label: "+25% к следующей награде", icon: "+25%", weight: 13 },
  { type: "LUCKY_DROP", label: "Lucky Drop", icon: "✦", weight: 11 },
  { type: "SAFE_OPEN", label: "Safe Open", icon: "◉", weight: 9 },
  { type: "DOUBLE_DROP", label: "Double Drop", icon: "2×", weight: 12 },
];

const descriptions: Record<string, string> = {
  ZEON_SECRET: "Получаешь одну недостающую букву из слова ZEON. Собери все четыре — секрет будет открыт.",
  DEPOSIT_RANDOM_SKIN: "После подходящего пополнения за тобой закрепляется случайный скин. Чем дороже предмет, тем ниже его шанс.",
  FREE_CASE: "Бесплатное открытие одного из активных кейсов Zeon без списания Z-Coin за само открытие.",
  ZCOIN_RAIN: "Случайная пачка Z-Coin. Начисление сохраняется за аккаунтом и отображается в бонусах.",
  Z_BOOST: "Следующая подходящая награда получает +25% Z-Coin. Бонус одноразовый.",
  LUCKY_DROP: "Улучшает шанс получить более редкий дроп при следующем открытии кейса.",
  SAFE_OPEN: "Защита следующего открытия от самого слабого варианта дропа.",
  DOUBLE_DROP: "Следующее подходящее открытие может дать дополнительный случайный дроп.",
};

const fallbackDeposits: DepositReward[] = [
  { amount: 50, label: "Пополнение от 50 Z-Coin", weight: 18 },
  { amount: 100, label: "Пополнение от 100 Z-Coin", weight: 14 },
  { amount: 250, label: "Пополнение от 250 Z-Coin", weight: 9 },
  { amount: 500, label: "Пополнение от 500 Z-Coin", weight: 5 },
  { amount: 1000, label: "Пополнение от 1000 Z-Coin", weight: 2.5 },
  { amount: 2500, label: "Пополнение от 2500 Z-Coin", weight: 1 },
];

function Icon({ item }: { item: WheelItem }) {
  return <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/10 text-lg font-black text-violet-100">{item.icon}</div>;
}

export default function FortuneWheelPage() {
  const [wheel, setWheel] = useState(fallbackWheel);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [depositRewards, setDepositRewards] = useState<DepositReward[]>(fallbackDeposits);
  const [mode, setMode] = useState<Mode>("BONUS");
  const [spinning, setSpinning] = useState(false);
  const [reelPosition, setReelPosition] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [letterState, setLetterState] = useState<LetterState>({ collected: [], completed: false });

  useEffect(() => {
    void fetch("/api/bonuses/fortune", { cache: "no-store" }).then(async (r) => {
      const d = await r.json();
      if (r.ok) { setWheel(d.wheel ?? fallbackWheel); setCases(d.cases ?? []); setDepositRewards(d.depositRewards ?? fallbackDeposits); setLetterState(d.letterState ?? { collected: [], completed: false }); }
    }).catch(() => {});
  }, []);

  const reelItems = useMemo(() => {
    if (mode === "CASE") return cases.map((item) => ({ key: item.id, title: item.name, subtitle: `${item.price} Z-Coin`, image: item.image, icon: "▣" }));
    if (mode === "DEPOSIT") return depositRewards.map((item) => ({ key: String(item.amount), title: `${item.amount} Z-Coin`, subtitle: "минимум пополнения", icon: "Z" }));
    return wheel.map((item) => ({ key: item.type, title: item.label, subtitle: "бонус Zeon", icon: item.icon }));
  }, [mode, cases, depositRewards, wheel]);

  const selectedCase = result?.caseId ? cases.find((c) => c.id === result.caseId) : null;

  const spin = async () => {
    if (spinning || reelItems.length === 0) return;
    setSpinning(true); setResult(null); setError("");
    try {
      const idempotencyKey = crypto.randomUUID();
      const r = await fetch("/api/bonuses/fortune", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey, mode }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Не удалось запустить рулетку.");
      const final = Number.isInteger(d.sectorIndex) ? d.sectorIndex : 0;
      const count = reelItems.length;
      const target = final + count * 3;
      setReelPosition(target);
      window.setTimeout(() => { setResult(d); setLetterState(d.letterState ?? letterState); setSpinning(false); window.dispatchEvent(new Event("zeon-profile-updated")); }, 5000);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка рулетки."); setSpinning(false); }
  };

  const switchMode = (next: Mode) => { if (spinning) return; setMode(next); setResult(null); setError(""); setReelPosition(0); setExpanded(null); };

  return <main className="min-h-screen bg-[#05070d] text-white"><Header /><section className="px-3 pb-28 pt-4 sm:px-5 sm:pt-6"><div className="mx-auto max-w-[1440px] overflow-hidden rounded-[30px] border border-white/10 bg-[#070b11]"><div className="border-b border-white/10 px-4 py-4"><RecentDropsStrip title="Последние дропы" /></div><div className="px-3 py-7 sm:px-8 sm:py-9"><div className="mx-auto max-w-6xl"><div className="mb-7 text-center"><p className="text-xs font-semibold uppercase tracking-[.3em] text-violet-300">ZEONGGSTORE • БОНУСЫ</p><h1 className="mt-3 text-3xl font-black uppercase sm:text-5xl">Барабан фортуны</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">Теперь награда крутится в отдельном видимом барабане прямо перед игроком — как на игровых case-сайтах.</p></div>

<div className="mb-5 flex flex-wrap justify-center gap-2"><ModeButton active={mode === "BONUS"} onClick={() => switchMode("BONUS")}>8 бонусов</ModeButton><ModeButton active={mode === "CASE"} onClick={() => switchMode("CASE")}>Кейсы</ModeButton><ModeButton active={mode === "DEPOSIT"} onClick={() => switchMode("DEPOSIT")}>Депозит</ModeButton></div>

<div className="rounded-[30px] border border-violet-400/20 bg-[#0a0f18] p-3 shadow-[0_18px_80px_rgba(76,29,149,.16)] sm:p-6"><div className="mb-3 flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-[.22em] text-slate-500"><span>{mode === "BONUS" ? "Бонусный барабан" : mode === "CASE" ? "Барабан кейсов" : "Барабан пополнения"}</span><span>{mode === "DEPOSIT" ? "Чем выше сумма — тем ниже шанс" : "Результат выбирается сервером"}</span></div>
  <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#060910] px-0 py-7 sm:py-9"><div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-20 bg-gradient-to-r from-[#060910] to-transparent sm:w-32" /><div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-20 bg-gradient-to-l from-[#060910] to-transparent sm:w-32" /><div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-[2px] -translate-x-1/2 bg-violet-300 shadow-[0_0_22px_rgba(196,181,253,.9)]" /><div className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2"><div className="h-0 w-0 border-l-[11px] border-r-[11px] border-t-[17px] border-l-transparent border-r-transparent border-t-violet-200" /></div><div className="pointer-events-none absolute bottom-0 left-1/2 z-30 -translate-x-1/2"><div className="h-0 w-0 border-l-[11px] border-r-[11px] border-b-[17px] border-l-transparent border-r-transparent border-b-violet-200" /></div>
    <div className="flex w-max gap-3" style={{ transform: `translateX(calc(50% - 86px - ${reelPosition * 172}px))`, transition: spinning ? "transform 5s cubic-bezier(.12,.72,.17,1)" : "transform .35s ease" }}>{Array.from({ length: 7 }).flatMap((_, round) => reelItems.map((item, index) => <div key={`${round}-${item.key}`} className="flex h-[126px] w-[160px] shrink-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-[#141a28] to-[#0c111b] p-3 text-center shadow-[0_10px_30px_rgba(0,0,0,.22)]"><div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-violet-300/20 bg-violet-500/10 text-sm font-black text-violet-100">{item.image ? <img src={item.image} alt="" className="h-full w-full object-contain" /> : item.icon}</div><p className="mt-2 line-clamp-2 text-[11px] font-black leading-4 text-white">{item.title}</p><p className="mt-1 line-clamp-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">{item.subtitle}</p></div>))}</div>
  </div>
  <div className="mt-4 flex flex-col items-center gap-3"><button disabled={spinning || reelItems.length === 0} onClick={() => void spin()} className="w-full max-w-sm rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 py-4 text-sm font-black uppercase tracking-wide shadow-[0_10px_35px_rgba(124,58,237,.28)] transition hover:brightness-110 disabled:opacity-50">{spinning ? "Барабан вращается..." : "Крутить барабан"}</button><button onClick={() => setInfo((v) => !v)} className="text-xs font-bold text-violet-300">? Как работает барабан</button>{info && <div className="max-w-2xl rounded-2xl border border-white/10 bg-white/[.03] p-4 text-xs leading-5 text-slate-300">Результат выбирается сервером до анимации, а барабан только визуально доезжает до нужной панели. В режиме «Кейсы» в пул попадают активные кейсы сайта. В режиме «Депозит» большие требования к пополнению имеют меньший вес и, следовательно, меньший шанс. Платёжная система не подключается.</div>}</div>
</div>

{mode === "BONUS" && <div className="mt-6 rounded-[26px] border border-white/10 bg-[#0a0f18] p-4 sm:p-5"><div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-black">8 бонусов Zeon</h2><p className="mt-1 text-xs text-slate-500">Нажми на панель — картинка сменится на короткое описание.</p></div><span className="text-xs font-bold text-violet-300">8 вариантов</span></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{wheel.map((item) => { const open = expanded === item.type; return <button type="button" key={item.type} onClick={() => setExpanded(open ? null : item.type)} className={`min-h-[145px] rounded-2xl border p-3 text-left transition ${open ? "border-violet-300/40 bg-violet-500/10" : "border-white/10 bg-white/[.025] hover:border-violet-300/20 hover:bg-white/[.04]"}`}><div className="flex min-h-[108px] flex-col items-center justify-center text-center">{open ? <p className="text-xs font-semibold leading-5 text-slate-200">{descriptions[item.type]}</p> : <><Icon item={item} /><span className="mt-3 line-clamp-2 text-[10px] font-black uppercase leading-4 text-slate-300">{item.label}</span></>}</div></button>; })}</div></div>}

{result && <div className="mt-5 rounded-[26px] border border-violet-300/25 bg-violet-500/10 p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Твоя награда</p><h2 className="mt-2 text-2xl font-black">{result.label}</h2>{selectedCase && <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-3"><img src={selectedCase.image} alt={selectedCase.name} className="h-20 w-20 object-contain" /><div><p className="font-black">{selectedCase.name}</p><p className="text-xs text-slate-400">{selectedCase.price} Z-Coin</p></div></div>}{mode === "DEPOSIT" && <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-slate-400">Условие награды</p><p className="mt-1 text-xl font-black">Пополнение от {result.rewardValue} Z-Coin</p><p className="mt-1 text-xs text-slate-500">Большие суммы имеют меньший шанс выпадения.</p></div>}{Boolean(result.metadata?.letter) && <div className="mt-4 rounded-2xl border border-violet-300/20 bg-black/20 p-4 text-center"><p className="text-xs text-slate-400">Тебе выпала буква</p><p className="mt-1 text-4xl font-black text-violet-300">{String(result.metadata?.letter)}</p></div>}<p className="mt-4 text-xs text-slate-300">Бонус сохранён за аккаунтом и будет использован по своим условиям.</p></div>}
{error && <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
</div></div></div></section></main>;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wide transition ${active ? "border-violet-300/40 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/[.03] text-slate-500 hover:text-slate-200"}`}>{children}</button>; }

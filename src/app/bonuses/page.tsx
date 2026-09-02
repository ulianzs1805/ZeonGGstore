"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";

type CaseItem = { id: string; name: string; image: string; price: number };
type WheelItem = { type: string; label: string; icon: string; weight: number };
type Result = { rewardType: string; rewardValue: number | null; caseId: string | null; label: string; code?: string | null; sectorIndex?: number };

const fallbackWheel: WheelItem[] = [
  { type: "DEPOSIT", label: "Депозит", icon: "%", weight: 18 },
  { type: "CASE", label: "Бесплатный кейс", icon: "▣", weight: 18 },
  { type: "BALANCE", label: "Бесплатный баланс", icon: "Z", weight: 16 },
  { type: "ZCOIN", label: "Z-Coin", icon: "Z", weight: 15 },
  { type: "ZCOIN", label: "Большой Z-Coin", icon: "Z", weight: 8 },
  { type: "DEPOSIT", label: "Депозит", icon: "%", weight: 10 },
  { type: "CASE", label: "Бесплатный кейс", icon: "▣", weight: 8 },
  { type: "BALANCE", label: "Бесплатный баланс", icon: "Z", weight: 7 },
];

function FortuneIcon({ item }: { item: WheelItem }) {
  return <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-xl font-black shadow-[0_0_24px_rgba(168,85,247,.18)] ${item.type === "DEPOSIT" ? "border-fuchsia-300/40 bg-fuchsia-500/15 text-fuchsia-200" : item.type === "CASE" ? "border-orange-300/40 bg-orange-500/15 text-orange-200" : "border-violet-300/40 bg-violet-500/15 text-violet-200"}`}>{item.icon}</div>;
}

export default function BonusesPage() {
  const [wheel, setWheel] = useState<WheelItem[]>(fallbackWheel);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const [promo, setPromo] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { void fetch("/api/bonuses/fortune", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) return; setWheel(d.wheel ?? fallbackWheel); setCases(d.cases ?? []); }).catch(() => undefined); }, []);

  const caseRoulette = useMemo(() => cases.length ? Array.from({ length: 24 }, (_, i) => cases[i % cases.length]) : [], [cases]);
  const selectedCase = result?.caseId ? cases.find((item) => item.id === result.caseId) : null;

  const spin = async () => {
    if (spinning) return;
    setSpinning(true); setResult(null); setError("");
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/bonuses/fortune", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось запустить колесо.");
      const sector = Number.isInteger(data.sectorIndex) ? data.sectorIndex : 0;
      setRotation((current) => current + 1440 - sector * 45);
      window.setTimeout(() => { setResult(data); setSpinning(false); window.dispatchEvent(new Event("zeon-profile-updated")); }, 2800);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка колеса."); setSpinning(false); }
  };

  const applyPromo = () => { if (!result?.code) return; setPromo(result.code); setNotice("Промокод сохранён для пополнения."); };

  return <main className="min-h-screen overflow-x-hidden bg-[#05070d] text-white"><Header/><section className="px-4 pb-12 pt-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1440px] overflow-hidden rounded-[30px] border border-white/10 bg-[#070b11]/90"><div className="border-b border-white/10 px-4 py-4 sm:px-6"><RecentDropsStrip title="Последние дропы"/></div>
    <div className="px-4 py-9 sm:px-6 lg:px-10 lg:py-14"><div className="mx-auto max-w-6xl">
      <div className="mb-9 text-center"><p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-violet-300/90">ZEONGGSTORE • БОНУСЫ</p><h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] sm:text-5xl">Колесо фортуны</h1><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400">8 трапециевидных ячеек. Сервер выбирает результат, а анимация всегда останавливается именно на выпавшей ячейке.</p></div>
      <div className="grid gap-7 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[30px] border border-violet-400/20 bg-[#0a0f18]/90 p-4 shadow-[0_0_70px_rgba(124,58,237,.10)] sm:p-7">
          <div className="relative mx-auto max-w-[660px] overflow-hidden py-5"><div className="pointer-events-none absolute left-1/2 top-0 z-20 h-8 w-10 -translate-x-1/2"><div className="mx-auto h-0 w-0 border-x-[12px] border-t-0 border-b-[22px] border-x-transparent border-b-violet-200 drop-shadow-[0_0_10px_rgba(168,85,247,.8)]"/></div>
            <div className="relative mx-auto aspect-square max-w-[590px] rounded-full border-[10px] border-[#181326] bg-[radial-gradient(circle,#171126_0%,#0b0c15_68%,#05070d_100%)] p-3 shadow-[0_0_70px_rgba(124,58,237,.22)]" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 2.8s cubic-bezier(.12,.76,.16,1)" : "none" }}>
              {wheel.map((item, i) => { const angle = i * 45; return <div key={`${item.type}-${i}`} className="absolute left-1/2 top-1/2 h-[47%] w-[26%] -translate-x-1/2 -translate-y-1/2 origin-center" style={{ transform: `rotate(${angle}deg) translateY(-48%)` }}><div className="relative flex h-full w-full items-center justify-center" style={{ clipPath: "polygon(18% 0,82% 0,100% 100%,0 100%)" }}><div className="absolute inset-[1px] rounded-[8px] border border-white/10 bg-[#111827]" style={{ clipPath: "polygon(18% 0,82% 0,100% 100%,0 100%)" }}/><div className="relative z-10 flex flex-col items-center gap-2 text-center"><FortuneIcon item={item}/><span className="max-w-[90px] text-[10px] font-black uppercase leading-3 text-slate-200">{item.label}</span></div></div></div>; })}
              <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-8 border-[#090a11] bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-black uppercase tracking-[.12em] shadow-[0_0_35px_rgba(168,85,247,.6)]">ZEON</div>
            </div></div>
          <div className="mt-5 flex flex-col items-center gap-3"><button type="button" disabled={spinning} onClick={() => void spin()} className="w-full max-w-sm rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 py-4 text-sm font-black uppercase tracking-[.12em] shadow-[0_0_32px_rgba(168,85,247,.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{spinning ? "Колесо крутится..." : "Крутить колесо"}</button><button type="button" onClick={() => setInfo((v) => !v)} className="text-xs font-bold text-violet-300">? Как работает колесо</button>{info && <div className="max-w-lg rounded-2xl border border-white/10 bg-white/[.03] p-4 text-xs leading-5 text-slate-300">В колесе 8 ячеек. Сервер случайно выбирает награду. Депозит — 5–30%; бесплатный баланс — 5–50 Z-Coin. Бесплатный кейс выбирается из реальных кейсов сайта: чем дешевле кейс, тем выше его вес. Если уже есть депозитный бонус, меньший новый бонус не заменяет больший.</div>}</div>
        </div>
        <div className="space-y-5">
          <div className="rounded-[26px] border border-white/10 bg-[#0a0f18]/90 p-5 sm:p-6"><h2 className="text-xl font-black">8 панелей</h2><div className="mt-4 grid grid-cols-2 gap-3">{wheel.map((item, i) => <div key={i} className="flex min-h-[92px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[.025] p-3 text-center"><FortuneIcon item={item}/><span className="mt-2 text-[10px] font-black uppercase text-slate-300">{item.label}</span></div>)}</div></div>
          {result && <div className="rounded-[26px] border border-violet-300/25 bg-violet-500/10 p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Твоя награда</p><h2 className="mt-2 text-2xl font-black">{result.label}</h2>{selectedCase && <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-3"><img src={selectedCase.image} alt={selectedCase.name} className="h-20 w-20 object-contain"/><div><p className="font-black">{selectedCase.name}</p><p className="text-xs text-slate-400">Цена: {selectedCase.price} Z-Coin</p></div></div>}{result.rewardType === "DEPOSIT" && result.code && <><p className="mt-3 text-xs text-slate-400">Промокод хранится в бонусах и готов к пополнению.</p><div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm">{result.code}</div><div className="mt-3 flex gap-2"><button onClick={applyPromo} className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-xs font-black uppercase">Применить</button><Link href="/bonuses#deposit" className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-center text-xs font-black uppercase">Пополнить</Link></div></>}</div>}
          {error && <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
          {promo && <div id="deposit" className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4"><p className="text-xs font-black uppercase text-emerald-200">Бонус применён</p><p className="mt-1 text-sm text-slate-200">При открытии пополнения промокод будет подставлен автоматически.</p><div className="mt-3 rounded-xl bg-black/20 px-3 py-2 font-mono text-xs">{promo}</div></div>}
          <div className="rounded-[26px] border border-white/10 bg-[#0a0f18]/90 p-5 sm:p-6"><h2 className="text-xl font-black">Промокод</h2><div className="mt-4 flex gap-2"><input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="ZEON2026" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#060a12] px-4 py-3 text-sm outline-none"/><button onClick={() => setNotice(promo.trim() ? "Промокод готов к активации." : "Введи промокод.")} className="rounded-xl bg-violet-600 px-4 py-3 text-xs font-black uppercase">Применить</button></div>{notice && <p className="mt-3 text-xs text-violet-200">{notice}</p>}</div>
        </div>
      </div>
    </div></div></div></section></main>;
}

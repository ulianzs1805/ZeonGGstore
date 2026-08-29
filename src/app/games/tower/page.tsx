"use client";

import { useMemo, useState } from "react";

const FLOORS = 8;
const CELLS = 3;
const MULTIPLIERS = [1.15, 1.35, 1.65, 2.05, 2.6, 3.35, 4.4, 6.0];

export default function TowerPage() {
  const [floor, setFloor] = useState(0);
  const [active, setActive] = useState(false);
  const [lost, setLost] = useState(false);
  const [stake, setStake] = useState(10);
  const [current, setCurrent] = useState(0);
  const [mine, setMine] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);

  const multiplier = floor > 0 ? MULTIPLIERS[floor - 1] : 1;
  const payout = useMemo(() => Math.floor(stake * multiplier * 100) / 100, [stake, multiplier]);

  function start() {
    const value = Math.max(1, Number(stake) || 0);
    setStake(value);
    setFloor(0);
    setCurrent(0);
    setMine(null);
    setPicked([]);
    setLost(false);
    setActive(true);
  }

  function pick(cell: number) {
    if (!active || lost || floor >= FLOORS || picked.length === floor + 1) return;
    const mineCell = Math.floor(Math.random() * CELLS);
    setMine(mineCell);
    setPicked((items) => [...items, cell]);
    if (cell === mineCell) {
      setLost(true);
      setActive(false);
      return;
    }
    setFloor((value) => value + 1);
    setCurrent((value) => value + 1);
    setMine(null);
  }

  function cashout() {
    if (!active || lost || floor === 0) return;
    setActive(false);
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-72px)] max-w-5xl px-4 pb-32 pt-6 sm:px-6 lg:pb-12 lg:pt-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-violet-300">ZeonGGStore • Games</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">Башня</h1>
          <p className="mt-2 text-sm text-slate-400">Поднимайся этаж за этажом. На каждом этаже одна мина.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#101421] px-4 py-3 text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Текущий множитель</p>
          <p className="text-2xl font-black text-white">x{multiplier.toFixed(2)}</p>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="rounded-[30px] border border-violet-300/10 bg-[#0c101c] p-4 shadow-[0_25px_80px_rgba(0,0,0,.3)] sm:p-6">
          <div className="mb-5 grid grid-cols-8 gap-2">
            {Array.from({ length: FLOORS }, (_, index) => (
              <div key={index} className={`rounded-xl border px-2 py-3 text-center text-xs font-black ${index < floor ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : index === floor ? "border-violet-400/40 bg-violet-400/10 text-violet-200" : "border-white/5 bg-white/[.02] text-slate-600"}`}>
                {index + 1}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {Array.from({ length: FLOORS }, (_, reverse) => FLOORS - reverse - 1).map((level) => {
              const completed = level < floor;
              const currentLevel = level === floor;
              return (
                <div key={level} className={`rounded-2xl border p-2 transition ${currentLevel ? "border-violet-400/30 bg-violet-400/[.05]" : "border-white/5 bg-[#101421]"}`}>
                  <div className="mb-2 flex items-center justify-between px-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Этаж {level + 1}</span>
                    <span className="text-xs font-black text-violet-300">x{MULTIPLIERS[level].toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: CELLS }, (_, cell) => {
                      const selected = picked[level] === cell;
                      const revealMine = lost && level === floor && mine === cell;
                      return <button key={cell} type="button" disabled={!active || !currentLevel || completed} onClick={() => pick(cell)} className={`h-16 rounded-xl border text-xl font-black transition sm:h-20 ${revealMine ? "border-red-400/50 bg-red-500/15 text-red-300" : selected ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : currentLevel ? "border-violet-300/10 bg-[#151a2a] text-slate-500 hover:border-violet-300/30 hover:bg-violet-500/10" : "border-white/5 bg-[#0d111c] text-slate-700"}`}>
                        {revealMine ? "💣" : selected ? "✓" : "?"}
                      </button>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {lost && <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-center text-sm font-black text-red-300">Мина! Ставка проиграна.</div>}
          {!active && !lost && floor >= FLOORS && <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center text-sm font-black text-emerald-300">Башня пройдена!</div>}
        </div>

        <aside className="h-fit rounded-[30px] border border-white/10 bg-[#0e1220] p-5">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500">Ставка Z-Coin</label>
          <input type="number" min={1} value={stake} disabled={active} onChange={(event) => setStake(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#151a2a] px-4 py-3 font-black text-white outline-none focus:border-violet-400/40" />
          <div className="mt-5 rounded-2xl border border-white/5 bg-white/[.03] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Забрать сейчас</p>
            <p className="mt-1 text-2xl font-black text-white">{payout} Z</p>
          </div>
          {!active ? <button type="button" onClick={start} className="mt-4 w-full rounded-2xl bg-violet-500 px-4 py-3 font-black text-white transition hover:bg-violet-400">{lost || floor > 0 ? "Новая игра" : "Начать"}</button> : <button type="button" disabled={floor === 0} onClick={cashout} className="mt-4 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">Забрать {payout} Z</button>}
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">Одна безопасная клетка на каждом этаже. Чем выше поднимаешься, тем больше множитель.</p>
        </aside>
      </section>
    </main>
  );
}

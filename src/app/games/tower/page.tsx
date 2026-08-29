"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Difficulty = "easy" | "medium" | "hard";
type Game = {
  gameId: string;
  difficulty: Difficulty;
  stake: number;
  currentAmount: number;
  floor: number;
  floors: number;
  mines: number;
  saveAvailable: boolean;
  errors: number;
  multiplier: number;
  status: string;
  minePositions?: number[];
  revealedMine?: number | null;
  message?: string;
};

const DIFFICULTIES = {
  easy: { title: "Лёгкий", floors: 4, text: "4 этажа · до ~2,5×", accent: "emerald" },
  medium: { title: "Средний", floors: 8, text: "8 этажей · выше награда", accent: "amber" },
  hard: { title: "Сложный", floors: 16, text: "16 этажей · 1 сейв", accent: "red" },
} as const;

function key() {
  return crypto.randomUUID();
}

function money(value: number) {
  return Math.max(0, Math.floor(value)).toLocaleString("ru-RU");
}

export default function TowerPage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [stake, setStake] = useState(10);
  const [mines, setMines] = useState(1);
  const [game, setGame] = useState<Game | null>(null);
  const [balance, setBalance] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const [lastResult, setLastResult] = useState<"safe" | "mine" | "cashout" | "complete" | null>(null);

  const config = DIFFICULTIES[difficulty];
  const currentMines = game?.mines ?? mines;
  const payout = game?.currentAmount ?? stake;

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/tower", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить Башню");
      setBalance(Number(data.balance) || 0);
      if (data.game) {
        setGame(data.game);
        setDifficulty(data.game.difficulty);
        setMines(data.game.mines);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function request(body: Record<string, unknown>) {
    const response = await fetch("/api/tower", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, idempotencyKey: key() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Операция не выполнена");
    return data;
  }

  async function start() {
    if (stake < 10 || stake > balance) return;
    setBusy(true); setError(""); setLastResult(null);
    try {
      const data = await request({ action: "start", difficulty, stake: Math.floor(stake) });
      setGame(data.game); setBalance(data.balance); setMines(data.game.mines);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось начать игру");
    } finally { setBusy(false); }
  }

  async function pick(cell: number) {
    if (!game || game.status !== "ACTIVE" || busy) return;
    setBusy(true); setError("");
    try {
      const data = await request({ action: "pick", gameId: game.gameId, cell, mines: game.difficulty === "hard" ? undefined : mines });
      setGame(data.game);
      if (typeof data.balance === "number") setBalance(data.balance);
      setLastResult(data.game.status === "COMPLETED" ? "complete" : data.game.revealedMine !== null && data.game.revealedMine !== undefined ? "mine" : "safe");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Выбор не выполнен");
    } finally { setBusy(false); }
  }

  async function cashout() {
    if (!game || game.status !== "ACTIVE" || game.floor <= 0 || busy) return;
    setBusy(true); setError("");
    try {
      const data = await request({ action: "cashout", gameId: game.gameId });
      setGame(data.game); setBalance(data.balance); setLastResult("cashout");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось забрать выигрыш");
    } finally { setBusy(false); }
  }

  function newGame() {
    setGame(null); setLastResult(null); setError(""); setMines(1);
  }

  const floorRows = useMemo(() => Array.from({ length: config.floors }, (_, i) => config.floors - i - 1), [config.floors]);
  const activeFloor = game?.floor ?? 0;
  const isRunning = game?.status === "ACTIVE";

  return (
    <main className="mx-auto min-h-[calc(100vh-72px)] max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:pb-12 lg:pt-10">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.24em] text-violet-300">ZeonGGStore · Games</p>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-3xl font-black text-white sm:text-5xl">Башня</h1>
            <button type="button" onClick={() => setHelp(true)} aria-label="Что такое Башня?" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[.04] text-sm font-black text-slate-300 transition hover:border-violet-300/30 hover:text-white">?</button>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Поднимайся по этажам, выбирай безопасную позицию и забирай накопленную сумму в любой доступный момент.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#101421] px-5 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Баланс</p>
          <p className="mt-1 text-xl font-black text-white">{money(balance)} <span className="text-sm text-violet-300">Z</span></p>
        </div>
      </header>

      {!game && (
        <section className="mb-5 grid gap-3 md:grid-cols-3">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((item) => {
            const selected = difficulty === item;
            const d = DIFFICULTIES[item];
            return <button key={item} type="button" onClick={() => setDifficulty(item)} className={`rounded-3xl border p-5 text-left transition ${selected ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-[#0e1220] hover:border-white/20"}`}>
              <div className="flex items-center justify-between"><span className="text-lg font-black text-white">{d.title}</span><span className="text-xs font-black text-slate-500">{d.floors} этаж.</span></div>
              <p className="mt-2 text-sm text-slate-400">{d.text}</p>
            </button>;
          })}
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="rounded-[30px] border border-violet-300/10 bg-[#0b0f19] p-3 shadow-[0_25px_80px_rgba(0,0,0,.32)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Сложность</p><p className="font-black text-white">{DIFFICULTIES[game?.difficulty ?? difficulty].title}</p></div>
            <div className="text-right"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Этажи</p><p className="font-black text-white">{game?.floor ?? 0} / {config.floors}</p></div>
          </div>

          <div className="space-y-2">
            {floorRows.map((level) => {
              const current = level === activeFloor && isRunning;
              const completed = game ? level < activeFloor : false;
              const revealed = game?.minePositions ?? [];
              return <div key={level} className={`rounded-2xl border p-2 ${current ? "border-violet-400/30 bg-violet-500/[.045]" : "border-white/5 bg-[#101421]"}`}>
                <div className="mb-2 flex items-center justify-between px-2"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Этаж {level + 1}</span><span className="text-xs font-black text-violet-300">{completed ? "✓ Пройден" : current ? `${currentMines} мин` : ""}</span></div>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }, (_, cell) => {
                    const mine = game?.revealedMine === cell || (lastResult === "mine" && revealed.includes(cell));
                    const selected = completed && game?.floor && level < game.floor;
                    return <button key={cell} type="button" disabled={!current || busy} onClick={() => void pick(cell)} className={`h-14 rounded-xl border text-lg font-black transition sm:h-16 ${mine ? "border-red-400/40 bg-red-500/15 text-red-300" : selected ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : current ? "border-violet-300/10 bg-[#151a2a] text-slate-500 hover:border-violet-300/35 hover:bg-violet-500/10" : "border-white/5 bg-[#0d111c] text-slate-700"}`}>
                      {mine ? "💣" : selected ? "✓" : "?"}
                    </button>;
                  })}
                </div>
              </div>;
            })}
          </div>

          {lastResult === "mine" && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-center text-sm font-black text-red-300">💣 Мина. {game?.message}</div>}
          {lastResult === "safe" && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center text-sm font-black text-emerald-300">✓ Безопасно. Следующий этаж открыт.</div>}
          {lastResult === "cashout" && <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4 text-center text-sm font-black text-violet-200">💰 Вы забрали {money(payout)} Z-Coin.</div>}
          {lastResult === "complete" && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center text-sm font-black text-emerald-300">🏆 Башня пройдена. Выплата {money(payout)} Z-Coin.</div>}
          {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-center text-sm font-black text-red-300">{error}</div>}
        </div>

        <aside className="h-fit rounded-[30px] border border-white/10 bg-[#0e1220] p-5">
          {!game ? <>
            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Начальная ставка</label>
            <input type="number" min={10} step={1} value={stake} disabled={busy} onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#151a2a] px-4 py-3 font-black text-white outline-none focus:border-violet-400/40" />
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/5 bg-white/[.03] p-3">
              <div><p className="text-[10px] text-slate-500">Мин. ставка</p><p className="font-black text-white">10 Z</p></div>
              <div className="text-right"><p className="text-[10px] text-slate-500">Ваш баланс</p><p className="font-black text-white">{money(balance)} Z</p></div>
            </div>
            <button type="button" disabled={busy || stake < 10 || stake > balance} onClick={() => void start()} className="mt-4 w-full rounded-2xl bg-violet-500 px-4 py-3 font-black text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Запуск…" : "Начать Башню"}</button>
          </> : <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/5 bg-white/[.03] p-3"><p className="text-[10px] text-slate-500">Начало</p><p className="mt-1 font-black text-white">{money(game.stake)} Z</p></div>
              <div className="rounded-2xl border border-violet-400/10 bg-violet-500/[.05] p-3"><p className="text-[10px] text-slate-500">Сейчас</p><p className="mt-1 font-black text-white">{money(game.currentAmount)} Z</p></div>
            </div>
            <div className="mt-3 rounded-2xl border border-white/5 bg-white/[.03] p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Множитель</p><p className="mt-1 text-3xl font-black text-white">x{game.multiplier.toFixed(2)}</p></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl border border-white/5 bg-white/[.025] p-3"><p className="text-slate-500">Мины</p><p className="mt-1 font-black text-white">{game.difficulty === "hard" ? `${game.mines} · фикс.` : game.mines}</p></div>
              <div className="rounded-2xl border border-white/5 bg-white/[.025] p-3"><p className="text-slate-500">Сейв</p><p className="mt-1 font-black text-white">{game.difficulty === "hard" ? (game.saveAvailable ? "1 доступен" : "нет") : "—"}</p></div>
            </div>
            {isRunning && game.difficulty !== "hard" && <div className="mt-4"><p className="text-xs font-black uppercase tracking-widest text-slate-500">Мин на этом этаже</p><div className="mt-2 grid grid-cols-4 gap-2">{Array.from({ length: 7 }, (_, i) => i + 1).map((count) => <button key={count} type="button" disabled={busy} onClick={() => setMines(count)} className={`rounded-xl border py-2 text-sm font-black ${mines === count ? "border-violet-400/40 bg-violet-500/15 text-white" : "border-white/10 bg-white/[.025] text-slate-500"}`}>{count}</button>)}</div></div>}
            {isRunning && <button type="button" disabled={busy || game.floor <= 0} onClick={() => void cashout()} className="mt-4 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">Забрать {money(game.currentAmount)} Z</button>}
            {game.status !== "ACTIVE" && <button type="button" disabled={busy} onClick={newGame} className="mt-4 w-full rounded-2xl bg-violet-500 px-4 py-3 font-black text-white">Новая игра</button>}
            {isRunning && <p className="mt-3 text-center text-xs leading-5 text-slate-500">После успешного выбора можно забрать сумму. На лёгком и среднем количестве мин можно менять перед каждым этажом.</p>}
          </>}
        </aside>
      </section>

      {help && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setHelp(false)}><div className="w-full max-w-lg rounded-[30px] border border-white/10 bg-[#101421] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-violet-300">Подсказка</p><h2 className="mt-1 text-2xl font-black text-white">Что такое Башня?</h2></div><button type="button" onClick={() => setHelp(false)} className="text-xl text-slate-500">×</button></div>
        <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300"><p>Вы начинаете с определённой суммы Z-Coin и проходите этажи, пытаясь увеличить её.</p><p><b className="text-white">Можно забрать раньше?</b><br />Да. После успешного этажа можно забрать текущую сумму.</p><p><b className="text-white">Что происходит при мине?</b><br />На лёгком и среднем уровне текущая сумма уменьшается на 25%, после чего можно продолжить. На сложном первый промах использует единственный сейв и уменьшает сумму на 75%; второй серьёзный промах завершает игру.</p><p><b className="text-white">Можно выбрать количество мин?</b><br />На лёгком и среднем — да, перед каждым этажом. На сложном количество мин задаёт режим.</p><p><b className="text-white">Чем больше мин?</b><br />Тем выше риск и потенциальный множитель. Точные коэффициенты Beta 1.0 будут балансироваться по результатам тестов.</p></div>
      </div></div>}
    </main>
  );
}

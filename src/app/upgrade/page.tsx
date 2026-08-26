"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Item = { id: string; name: string; rarity: string; image: string; price: number };
type Result = { success: boolean; chance: number; roll: number; target: Item; resultItem: Item | null; inputItem: Item | null; inputValue: number; balanceTopUp: number; totalInputValue: number };

const SPIN_MS = 4200;
const MIN_CHANCE = 25;
const money = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);
const chanceFor = (input: number, target: number) => Math.max(MIN_CHANCE, Math.min(100, target > 0 ? input / target * 100 : MIN_CHANCE));

export default function UpgradePage() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [targets, setTargets] = useState<Item[]>([]);
  const [balance, setBalance] = useState(0);
  const [inputId, setInputId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [topUp, setTopUp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<{ input: Item | null; target: Item; chance: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const input = inventory.find((x) => x.id === inputId) || null;
  const target = targets.find((x) => x.id === targetId) || null;
  const total = (input?.price || 0) + topUp;
  const chance = target && total > 0 ? chanceFor(total, target.price) : MIN_CHANCE;
  const shownChance = attempt?.chance ?? chance;
  const degrees = Math.max(90, Math.min(360, shownChance * 3.6));

  async function load() {
    const r = await fetch("/api/upgrader", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Не удалось загрузить апгрейдер");
    const inv = Array.isArray(d.inventory) ? d.inventory : [];
    setInventory(inv);
    setTargets(Array.isArray(d.targets) ? d.targets : []);
    setBalance(Number(d.balance) || 0);
    return inv as Item[];
  }

  useEffect(() => { load().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);

  function chooseInput(id: string) {
    if (busy || spinning) return;
    setInputId((current) => current === id ? "" : id);
    setTopUp(0);
    setError("");
    setResult(null);
  }

  function chooseTarget(id: string) {
    if (busy || spinning) return;
    setTargetId(id);
    setError("");
    setResult(null);
  }

  function setChancePreset(percent: number) {
    if (!target || busy || spinning) return;
    const base = input?.price || 0;
    const wanted = target.price * (percent / 100);
    const required = Math.max(0, Math.min(balance, wanted - base));
    setTopUp(Math.round(required * 100) / 100);
  }

  function chooseMultiplier(multiplier: number) {
    if (total <= 0 || busy || spinning) return;
    const desired = total * multiplier;
    const candidates = targets.filter((x) => x.price > total);
    const closest = candidates.reduce<Item | null>((best, item) => !best || Math.abs(item.price - desired) < Math.abs(best.price - desired) ? item : best, null);
    if (closest) setTargetId(closest.id);
  }

  function startRoulette(data: Result) {
    const sector = Math.max(90, Math.min(359.64, data.chance * 3.6));
    const margin = Math.min(5, Math.max(1.2, sector * 0.035, (360 - sector) * 0.035));
    const winMin = margin;
    const winMax = Math.max(winMin, sector - margin);
    const loseMin = Math.min(359.5, sector + margin);
    const loseMax = Math.max(loseMin, 360 - margin);
    const landing = data.success
      ? winMin + Math.random() * Math.max(0.01, winMax - winMin)
      : loseMin + Math.random() * Math.max(0.01, loseMax - loseMin);

    setAngle((current) => {
      const currentNorm = ((current % 360) + 360) % 360;
      const deltaToLanding = (landing - currentNorm + 360) % 360;
      return current + 2160 + deltaToLanding;
    });
    setSpinning(true);
    window.setTimeout(() => { setSpinning(false); void finalize(data); }, SPIN_MS + 100);
  }

  async function finalize(data: Result) {
    try {
      const fresh = await load();
      if (data.success && data.resultItem) {
        const won = fresh.find((x) => x.id === data.resultItem!.id) || fresh.find((x) => x.name.toLowerCase() === data.resultItem!.name.toLowerCase());
        setInputId(won?.id || "");
      } else setInputId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка синхронизации инвентаря");
    } finally {
      setTargetId("");
      setTopUp(0);
      setAttempt(null);
      setResult(data);
    }
  }

  async function upgrade() {
    if (!target || total <= 0 || target.price <= total || topUp > balance || busy || spinning) return;
    setBusy(true);
    setError("");
    setResult(null);
    const frozen = { input, target, chance };
    setAttempt(frozen);
    try {
      const r = await fetch("/api/upgrader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: input?.id || "", targetId: target.id, balanceTopUp: topUp, idempotencyKey: crypto.randomUUID() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Апгрейд не выполнен");
      setBalance((v) => Math.max(0, v - topUp));
      startRoulette(d);
    } catch (e) {
      setAttempt(null);
      setError(e instanceof Error ? e.message : "Ошибка апгрейда");
    } finally {
      setBusy(false);
    }
  }

  const availableTargets = useMemo(() => {
    const seen = new Set<string>();
    return targets.filter((x) => {
      const key = x.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return total > 0 ? x.price > total : true;
    });
  }, [targets, total]);

  if (loading) return <main className="min-h-screen bg-[#161219] p-8 text-center text-zinc-400">Загружаем апгрейдер...</main>;

  return <main className="min-h-screen bg-[#171219] pb-24 text-white">
    <div className="mx-auto max-w-[1280px] overflow-hidden">
      <section className="relative min-h-[720px] overflow-hidden border-y border-red-500/10 bg-[radial-gradient(circle_at_50%_35%,rgba(164,31,23,.38),transparent_42%),linear-gradient(180deg,#1c1114_0%,#171219_70%)] px-4 pt-8 sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_center,rgba(255,74,39,.18),transparent_70%)]" />
        <div className="relative grid grid-cols-[1fr_1.2fr_1fr] items-center gap-3 pt-10 sm:gap-8">
          <WeaponSlot item={attempt?.input || input} side="left" onShuffle={() => setInputId("")} />
          <div className="relative mx-auto flex w-full max-w-[520px] flex-col items-center">
            <div className="relative z-10 mb-[-40px] h-[310px] w-[310px] sm:h-[390px] sm:w-[390px]">
              <div className="absolute inset-[7%] rounded-full border-[8px] border-[#7b1717] bg-[#120f13] shadow-[0_0_35px_rgba(255,52,25,.35)]" style={{ background: `conic-gradient(from 0deg,#f0442d 0deg ${degrees}deg,#4d1821 ${degrees}deg 360deg)` }}>
                <div className="absolute inset-[8px] rounded-full bg-[#171319] shadow-inner">
                  <div className="absolute inset-0 flex items-center justify-center"><RobotCore /></div>
                  <div className="absolute inset-x-0 top-[12%] text-center text-[10px] font-black tracking-[.25em] text-[#ffb36e]">ШАНС</div>
                  <div className="absolute inset-x-0 top-[20%] text-center text-4xl font-black sm:text-6xl">{shownChance.toFixed(1)}%</div>
                </div>
                <div className="absolute left-1/2 top-[-10px] z-30 h-[calc(100%+20px)] w-1 -translate-x-1/2" style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 50%", transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.08,.72,.12,1)` : "transform .25s ease-out" }}>
                  <div className="absolute left-1/2 top-0 h-12 w-[3px] -translate-x-1/2 rounded-full bg-[#ff694c] shadow-[0_0_18px_#ff2d15]" />
                </div>
              </div>
            </div>
            <div className="relative z-20 -mt-4 h-[220px] w-[310px] sm:h-[250px] sm:w-[360px]"><RobotBody /></div>
          </div>
          <WeaponSlot item={attempt?.target || target} side="right" onShuffle={() => setTargetId("")} />
        </div>

        <div className="relative z-20 mx-auto -mt-2 max-w-5xl">
          <div className="mb-3 flex items-center justify-between text-xl font-black text-zinc-300"><span>Добавить баланс</span><span className="text-emerald-300">{money(topUp)} Z</span></div>
          <div className="rounded-2xl bg-[#28232d] px-4 py-3 shadow-inner">
            <input type="range" min="0" max={Math.max(0, Math.floor(balance * 100) / 100)} step="0.01" value={topUp} onChange={(e) => setTopUp(Math.max(0, Math.min(balance, Number(e.target.value))))} disabled={spinning || busy} className="h-3 w-full accent-[#ff5b41]" />
          </div>
          <div className="mt-5 grid grid-cols-7 overflow-hidden rounded-2xl border border-white/5 bg-[#2a252e] text-sm font-black sm:text-base">
            <button type="button" onClick={() => setTopUp(0)} className="min-h-16 border-r border-white/5 text-[#ff9a5a]">ϟ</button>
            {[30,50,70].map((p) => <button key={p} type="button" onClick={() => setChancePreset(p)} className="min-h-16 border-r border-white/5">{p}%</button>)}
            {[2,5,10].map((m) => <button key={m} type="button" onClick={() => chooseMultiplier(m)} className="min-h-16 border-r border-white/5 last:border-r-0">X{m}</button>)}
          </div>
          <button type="button" onClick={() => void upgrade()} disabled={!target || total <= 0 || target.price <= total || topUp > balance || busy || spinning} className="mt-6 w-full rounded-2xl bg-[#9f4144] py-6 text-xl font-black tracking-wide text-white shadow-[0_10px_40px_rgba(116,28,31,.35)] transition hover:bg-[#b84c4f] disabled:cursor-not-allowed disabled:opacity-45">
            {spinning ? "АПГРЕЙД ИДЁТ..." : busy ? "ОБРАБОТКА..." : "АПГРЕЙД"}
          </button>
          {result && <div className={`mt-4 rounded-xl p-3 text-center font-black ${result.success ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{result.success ? "УСПЕШНЫЙ АПГРЕЙД" : "АПГРЕЙД НЕ УДАЛСЯ"}</div>}
          {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-center text-sm text-red-200">{error}</div>}
        </div>
      </section>

      <section className="grid gap-4 bg-[#171219] px-4 py-8 md:grid-cols-2 sm:px-8">
        <InventoryPanel title="ИНВЕНТАРЬ" empty="Выбери скин или используй только баланс" items={inventory} active={inputId} onPick={chooseInput} />
        <InventoryPanel title="СКИНЫ" empty={total > 0 ? "Нет более дорогих целей" : "Сначала выбери скин или добавь баланс"} items={availableTargets} active={targetId} onPick={chooseTarget} />
      </section>
    </div>
  </main>;
}

function WeaponSlot({ item, side, onShuffle }: { item: Item | null; side: "left" | "right"; onShuffle: () => void }) {
  return <div className="flex flex-col items-center justify-center gap-4 text-center">
    <p className="text-lg font-black uppercase leading-none sm:text-2xl">ВЫБЕРИТЕ<br />СКИН</p>
    <div className="relative h-24 w-full max-w-[250px] sm:h-32">
      {item ? <Image src={item.image} alt={item.name} fill className="object-contain drop-shadow-[0_0_22px_rgba(255,53,35,.45)]" unoptimized /> : <div className="h-full w-full bg-[radial-gradient(ellipse_at_center,rgba(255,65,42,.3),transparent_70%)]" />}
    </div>
    <button type="button" onClick={onShuffle} className="grid h-16 w-16 place-items-center rounded-2xl bg-[#6f2929] text-3xl shadow-[0_0_25px_rgba(255,44,27,.3)]">⌘</button>
    <div className="h-2 w-full max-w-[260px] rounded-full bg-gradient-to-r from-transparent via-[#ff3d27] to-transparent shadow-[0_0_18px_#ff3d27]" />
    {item && <div className="max-w-[240px]"><p className="truncate font-black">{item.name}</p><p className="font-black text-[#ffb05d]">{money(item.price)} Z</p></div>}
    {!item && side === "left" && <p className="text-xs text-zinc-500">Можно играть только балансом</p>}
  </div>;
}

function RobotCore() { return <div className="relative h-[46%] w-[58%] rounded-[34%] border-[7px] border-[#b32d20] bg-[#11151a] shadow-[0_0_30px_rgba(255,62,30,.3)]"><div className="absolute inset-x-[14%] top-[28%] h-[28%] rounded-lg bg-[#05070a]" /><div className="absolute left-[24%] top-[37%] h-3 w-3 rounded-sm bg-[#ff9d3d] shadow-[0_0_12px_#ff8a2c]" /><div className="absolute right-[24%] top-[37%] h-3 w-3 rounded-sm bg-[#ff9d3d] shadow-[0_0_12px_#ff8a2c]" /></div>; }
function RobotBody() { return <div className="relative mx-auto h-full w-full"><div className="absolute left-1/2 top-0 h-[88%] w-[56%] -translate-x-1/2 rounded-t-[42%] border-x-4 border-t-4 border-[#7f2c26] bg-[linear-gradient(180deg,#303238,#15171c)]" /><div className="absolute bottom-[6%] left-1/2 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full border-4 border-[#9d2d23] bg-[#2b1618] text-2xl font-black text-[#ff6b45] shadow-[0_0_20px_rgba(255,56,32,.45)]">Z</div><div className="absolute bottom-0 left-[7%] h-[45%] w-[28%] rotate-[18deg] rounded-[45%] bg-gradient-to-b from-[#777] to-[#202125]" /><div className="absolute bottom-0 right-[7%] h-[45%] w-[28%] -rotate-[18deg] rounded-[45%] bg-gradient-to-b from-[#777] to-[#202125]" /></div>; }

function InventoryPanel({ title, empty, items, active, onPick }: { title: string; empty: string; items: Item[]; active: string; onPick: (id: string) => void }) {
  return <section className="rounded-[28px] bg-[#28242e] p-5 shadow-inner"><h2 className="mb-5 text-3xl font-light text-zinc-200">{title}</h2>{items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map((item) => <button key={item.id} type="button" onClick={() => onPick(item.id)} className={`rounded-2xl border p-3 text-left transition ${active === item.id ? "border-red-400 bg-red-500/10" : "border-white/10 bg-[#1e1b22] hover:border-red-400/50"}`}><div className="relative h-24"><Image src={item.image} alt={item.name} fill className="object-contain" unoptimized /></div><p className="truncate text-xs font-black">{item.name}</p><p className="mt-1 text-xs font-black text-[#ffb05d]">{money(item.price)} Z</p></button>)}</div> : <div className="rounded-2xl border border-white/10 bg-[#201d24] p-8 text-center text-zinc-500">{empty}</div>}</section>;
}

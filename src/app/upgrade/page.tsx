"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Item = { id: string; name: string; rarity: string; image: string; price: number };
type Result = { success: boolean; chance: number; roll: number; target: Item; resultItem: Item | null; inputItem: Item | null; inputValue: number; balanceTopUp: number; totalInputValue: number };

const SPIN_MS = 4200;
const MIN_CHANCE = 0.1;
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
  const [attempt, setAttempt] = useState<{ input: Item; target: Item; chance: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const input = inventory.find((x) => x.id === inputId) || null;
  const target = targets.find((x) => x.id === targetId) || null;
  const total = (input?.price || 0) + topUp;
  const chance = target ? chanceFor(total, target.price) : MIN_CHANCE;
  const shownChance = attempt?.chance ?? chance;
  const degrees = Math.max(.36, Math.min(360, shownChance * 3.6));

  async function load() {
    const r = await fetch("/api/upgrader", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Не удалось загрузить апгрейдер");
    const inv = Array.isArray(d.inventory) ? d.inventory : [];
    setInventory(inv); setTargets(Array.isArray(d.targets) ? d.targets : []); setBalance(Number(d.balance) || 0);
    return inv as Item[];
  }

  useEffect(() => { load().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);

  function chooseInput(id: string) {
    if (busy || spinning) return;
    setInputId(id); setTargetId(""); setTopUp(0); setError(""); setResult(null);
  }

  function chooseTarget(id: string) {
    if (busy || spinning) return;
    setTargetId(id); setError(""); setResult(null);
  }

  // The wheel must land from the CURRENT absolute angle. The pointer is fixed at 0deg.
  // Win is [0, sector), lose is [sector, 360). A hard margin prevents border ambiguity.
  function startRoulette(data: Result) {
    const sector = Math.max(0.36, Math.min(359.64, data.chance * 3.6));
    const margin = Math.min(4, Math.max(0.6, sector * 0.04, (360 - sector) * 0.04));
    const winMin = margin;
    const winMax = Math.max(winMin, sector - margin);
    const loseMin = Math.min(359.5, sector + margin);
    const loseMax = Math.max(loseMin, 360 - margin);
    const landing = data.success
      ? winMin + Math.random() * Math.max(0.01, winMax - winMin)
      : loseMin + Math.random() * Math.max(0.01, loseMax - loseMin);

    // Rotation direction of the visual pointer is clockwise, so compute the exact next absolute angle.
    setAngle((current) => {
      const currentNorm = ((current % 360) + 360) % 360;
      const deltaToLanding = (landing - currentNorm + 360) % 360;
      return current + 2160 + deltaToLanding;
    });
    setSpinning(true);
    window.setTimeout(() => { setSpinning(false); void finalize(data); }, SPIN_MS + 90);
  }

  async function finalize(data: Result) {
    try {
      const fresh = await load();
      if (data.success && data.resultItem) {
        const won = fresh.find((x) => x.id === data.resultItem!.id) || fresh.find((x) => x.name.toLowerCase() === data.resultItem!.name.toLowerCase());
        setInputId(won?.id || "");
      } else setInputId("");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка синхронизации инвентаря"); }
    finally { setTargetId(""); setTopUp(0); setAttempt(null); setResult(data); }
  }

  async function upgrade() {
    if (!input || !target || target.price <= total || topUp > balance || busy || spinning) return;
    setBusy(true); setError(""); setResult(null);
    const frozen = { input, target, chance };
    setAttempt(frozen);
    try {
      const r = await fetch("/api/upgrader", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: input.id, targetId: target.id, balanceTopUp: topUp, idempotencyKey: crypto.randomUUID() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Апгрейд не выполнен");
      setBalance((v) => Math.max(0, v - topUp));
      startRoulette(d);
    } catch (e) { setAttempt(null); setError(e instanceof Error ? e.message : "Ошибка апгрейда"); }
    finally { setBusy(false); }
  }

  const availableTargets = useMemo(() => {
    const seen = new Set<string>();
    return targets.filter((x) => {
      const key = x.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return total > 0 && x.price > total;
    });
  }, [targets, total]);

  if (loading) return <main className="min-h-screen bg-[#04050a] p-8 text-center text-slate-400">Загружаем апгрейдер...</main>;

  return <main className="min-h-screen bg-[#04050a] px-3 pb-24 pt-4 text-white">
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center justify-between rounded-2xl border border-violet-400/15 bg-[#0b0d15] p-4"><div><p className="text-xs font-black uppercase tracking-[.25em] text-violet-300">ZeonGGStore</p><h1 className="text-3xl font-black">Апгрейдер</h1></div><b className="text-yellow-300">{money(balance)} Z</b></header>
      {error && <div className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm">{error}</div>}
      <section className="rounded-3xl border border-violet-300/10 bg-[#0b0d15] p-4">
        <div className="grid grid-cols-[minmax(100px,1fr)_minmax(180px,1.5fr)_minmax(100px,1fr)] items-center gap-3 sm:gap-6">
          <SkinCard item={attempt?.input || input} title="ТВОЙ СКИН" />
          <div className="relative mx-auto aspect-square w-full max-w-[390px]">
            <div className="absolute inset-[4%] rounded-full p-[8px]" style={{ background: `conic-gradient(from 0deg,#f97316 0deg ${degrees}deg,#6d28d9 ${degrees}deg 360deg)` }}>
              <div className="relative h-full w-full rounded-full bg-[#070910]">
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-xs text-slate-500">ШАНС</span><b className="text-4xl sm:text-6xl">{shownChance.toFixed(1)}%</b><span className="mt-2 text-xs text-orange-300">ОРАНЖЕВЫЙ = WIN</span><span className="text-xs text-violet-300">ФИОЛЕТОВЫЙ = LOSE</span></div>
                <div className="absolute left-1/2 top-0 z-20 h-full w-1 -translate-x-1/2" style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 50%", transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.08,.72,.12,1)` : "transform .2s ease-out" }}><div className="absolute left-1/2 top-0 h-10 w-1 -translate-x-1/2 rounded bg-white shadow-[0_0_14px_white]" /></div>
              </div>
            </div>
          </div>
          <SkinCard item={attempt?.target || target} title="ЦЕЛЕВОЙ СКИН" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Доплата</p><input type="range" min="0" max={Math.floor(balance)} value={topUp} onChange={(e) => setTopUp(Math.max(0, Math.min(Math.floor(balance), Number(e.target.value))))} className="w-full" disabled={spinning}/><b className="text-yellow-300">+{money(topUp)} Z</b></div><div className="rounded-xl bg-black/20 p-3">Сумма: <b>{money(total)} Z</b></div><div className="rounded-xl bg-black/20 p-3">Цель: <b>{target ? `${money(target.price)} Z` : "—"}</b></div></div>
        <button onClick={() => void upgrade()} disabled={!input || !target || target.price <= total || busy || spinning} className="mt-4 w-full rounded-xl bg-violet-600 py-4 font-black uppercase disabled:bg-white/10">{spinning ? "Рулетка..." : busy ? "Обработка..." : "Сделать апгрейд"}</button>
      </section>
      <div className="mt-4 grid gap-4 md:grid-cols-2"><section className="rounded-2xl border border-white/10 bg-[#0b0d15] p-3"><h2 className="mb-3 font-black">ТВОЙ ИНВЕНТАРЬ</h2><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{inventory.map((x) => <ItemCard key={x.id} item={x} active={x.id === inputId} onClick={() => chooseInput(x.id)} />)}</div></section><section className="rounded-2xl border border-white/10 bg-[#0b0d15] p-3"><h2 className="mb-3 font-black">ДОСТУПНЫЕ ЦЕЛИ</h2><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{availableTargets.map((x) => <ItemCard key={x.id} item={x} active={x.id === targetId} onClick={() => chooseTarget(x.id)} />)}</div></section></div>
      {result && <div className={`mt-4 rounded-xl p-3 text-center font-black ${result.success ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{result.success ? "УСПЕШНЫЙ АПГРЕЙД" : "АПГРЕЙД НЕ УДАЛСЯ"}</div>}
    </div>
  </main>;
}

function SkinCard({ item, title }: { item: Item | null; title: string }) { return <div className="text-center"><p className="mb-2 text-xs text-slate-500">{title}</p><div className="relative mx-auto h-36 rounded-2xl border border-white/10 bg-black/20"><>{item ? <Image src={item.image} alt={item.name} fill className="object-contain p-3" unoptimized /> : <span className="flex h-full items-center justify-center text-slate-600">Выбери</span>}</></div>{item && <><p className="mt-2 truncate font-black">{item.name}</p><p className="text-yellow-300">{money(item.price)} Z</p></>}</div>; }
function ItemCard({ item, active, onClick }: { item: Item; active: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-xl border p-2 text-left ${active ? "border-violet-400 bg-violet-500/15" : "border-white/10 bg-black/20"}`}><div className="relative h-20"><Image src={item.image} alt={item.name} fill className="object-contain" unoptimized /></div><p className="truncate text-xs font-black">{item.name}</p><p className="text-xs text-yellow-300">{money(item.price)} Z</p></button>; }

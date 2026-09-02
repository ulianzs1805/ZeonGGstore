"use client";
import { useEffect, useState } from "react";
import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";

type CaseItem = { id: string; name: string; image: string; price: number };
type WheelItem = { type: string; label: string; icon: string; weight: number };
type LetterState = { collected: string[]; completed: boolean };
type Result = { rewardType: string; rewardValue: number | null; caseId: string | null; label: string; metadata?: Record<string, unknown>; letterState?: LetterState };

const fallbackWheel: WheelItem[] = [
  { type: "ZEON_SECRET", label: "Zeon Secret", icon: "Z", weight: 10 },
  { type: "DEPOSIT_RANDOM_SKIN", label: "Случайный скин за пополнение", icon: "◈", weight: 12 },
  { type: "FREE_CASE", label: "Бесплатное открытие кейса", icon: "▣", weight: 17 },
  { type: "ZCOIN_RAIN", label: "Z-Coin Rain", icon: "Z¢", weight: 16 },
  { type: "Z_BOOST", label: "+25% Z-Coin к следующей награде", icon: "+25%", weight: 13 },
  { type: "LUCKY_DROP", label: "Lucky Drop", icon: "✦", weight: 11 },
  { type: "SAFE_OPEN", label: "Safe Open", icon: "◉", weight: 9 },
  { type: "DOUBLE_DROP", label: "Double Drop", icon: "2×", weight: 12 },
];

function Icon({ item }: { item: WheelItem }) {
  return <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/10 text-xl font-black">{item.icon}</div>;
}

export default function BonusesPage() {
  const [wheel, setWheel] = useState(fallbackWheel);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const [letterState, setLetterState] = useState<LetterState>({ collected: [], completed: false });

  useEffect(() => {
    void fetch("/api/bonuses/fortune", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) {
          setWheel(d.wheel ?? fallbackWheel);
          setCases(d.cases ?? []);
          setLetterState(d.letterState ?? { collected: [], completed: false });
        }
      })
      .catch(() => {});
  }, []);

  const selectedCase = result?.caseId ? cases.find((c) => c.id === result.caseId) : null;

  const spin = async () => {
    if (spinning || wheel.length === 0) return;
    setSpinning(true);
    setResult(null);
    setError("");

    try {
      const r = await fetch("/api/bonuses/fortune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Не удалось запустить колесо.");

      const final = Number.isInteger(d.sectorIndex) ? d.sectorIndex : 0;
      const sectorAngle = 360 / wheel.length;

      // The pointer is fixed at 12 o'clock. Calculate one exact final angle
      // so the server-selected sector always lands directly under the pointer.
      const currentMod = ((rotation % 360) + 360) % 360;
      const desiredMod = ((360 - final * sectorAngle) % 360 + 360) % 360;
      const alignment = (desiredMod - currentMod + 360) % 360;
      const fullRounds = 5;
      const targetRotation = rotation + fullRounds * 360 + alignment;

      // One continuous animation: fast start, several full rotations, smooth
      // deceleration and a precise stop. The pointer itself never moves.
      setRotation(targetRotation);

      window.setTimeout(() => {
        setResult(d);
        setLetterState(d.letterState ?? letterState);
        setSpinning(false);
        window.dispatchEvent(new Event("zeon-profile-updated"));
      }, 5600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка колеса.");
      setSpinning(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070d] text-white">
      <Header />
      <section className="px-4 pb-12 pt-6">
        <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[30px] border border-white/10 bg-[#070b11]">
          <div className="border-b border-white/10 px-4 py-4"><RecentDropsStrip title="Последние дропы" /></div>
          <div className="px-4 py-9 sm:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-9 text-center">
                <p className="text-xs font-semibold uppercase tracking-[.3em] text-violet-300">ZEONGGSTORE • БОНУСЫ</p>
                <h1 className="mt-3 text-4xl font-black uppercase sm:text-5xl">Колесо фортуны</h1>
                <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-400">8 уникальных бонусов Zeon. Колесо разгоняется, проходит 5 полных оборотов и плавно останавливается на выигрышном секторе.</p>
              </div>

              <div className="grid gap-7 lg:grid-cols-[1.1fr_.9fr]">
                <div className="rounded-[30px] border border-violet-400/20 bg-[#0a0f18] p-4 sm:p-7">
                  <div className="relative mx-auto max-w-[590px] py-8">
                    {/* Fixed pointer. It is outside the rotating element. */}
                    <div className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2">
                      <div className="relative flex h-10 w-8 items-center justify-center">
                        <div className="absolute top-0 h-0 w-0 border-l-[16px] border-r-[16px] border-t-[34px] border-l-transparent border-r-transparent border-t-violet-200 drop-shadow-[0_0_10px_rgba(167,139,250,.9)]" />
                        <div className="absolute top-0 h-0 w-0 border-l-[10px] border-r-[10px] border-t-[22px] border-l-transparent border-r-transparent border-t-[#7c3aed]" />
                      </div>
                    </div>

                    <div
                      className="relative mx-auto aspect-square overflow-hidden rounded-full border-[10px] border-[#181326] bg-[#0b0c15] p-3 will-change-transform"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        transition: spinning ? "transform 5.6s cubic-bezier(.15,.75,.18,1)" : "none",
                      }}
                    >
                      {wheel.map((item, i) => (
                        <div
                          key={`${item.type}-${i}`}
                          className="absolute left-1/2 top-1/2 h-[47%] w-[26%] -translate-x-1/2 -translate-y-1/2"
                          style={{ transform: `rotate(${i * sectorAngle(wheel.length)}deg) translateY(-48%)` }}
                        >
                          <div className="flex h-full w-full flex-col items-center justify-center border border-white/10 bg-[#111827] text-center" style={{ clipPath: "polygon(18% 0,82% 0,100% 100%,0 100%)" }}>
                            <Icon item={item} />
                            <span className="mt-2 max-w-[100px] text-[10px] font-black uppercase leading-3">{item.label}</span>
                          </div>
                        </div>
                      ))}
                      <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-8 border-[#090a11] bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-black shadow-[0_0_30px_rgba(139,92,246,.25)]">ZEON</div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col items-center gap-3">
                    <div className="w-full max-w-md rounded-2xl border border-violet-300/20 bg-black/20 px-5 py-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[.35em] text-slate-500">Собери слово</p>
                      <div className="mt-2 flex justify-center gap-2">
                        {["Z", "e", "o", "n"].map((letter) => {
                          const have = letterState.collected.includes(letter.toUpperCase());
                          return <div key={letter} className={`flex h-11 w-11 items-center justify-center rounded-xl border text-lg font-black ${have ? "border-violet-300/60 bg-violet-500/20 text-white" : "border-white/10 bg-white/[.03] text-slate-700"}`}>{have ? letter : "?"}</div>;
                        })}
                      </div>
                      <p className={`mt-2 text-xs font-bold ${letterState.completed ? "text-violet-300" : "text-slate-500"}`}>{letterState.completed ? "ZEON SECRET открыт" : "Слово: Zeon • буквы сохраняются после каждого выигрыша"}</p>
                    </div>

                    <button disabled={spinning} onClick={() => void spin()} className="w-full max-w-sm rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 py-4 text-sm font-black uppercase disabled:opacity-50">{spinning ? "Колесо вращается..." : "Крутить колесо"}</button>
                    <button onClick={() => setInfo((v) => !v)} className="text-xs font-bold text-violet-300">? Как работает колесо</button>
                    {info && <div className="max-w-lg rounded-2xl border border-white/10 bg-white/[.03] p-4 text-xs leading-5 text-slate-300">Стрелка всегда стоит сверху и указывает на сектор. Колесо сначала быстро разгоняется, затем делает 5 полных оборотов и плавно замедляется до точной остановки на серверном результате. Zeon Secret даёт одну из букв Z, E, O, N — уже полученные буквы не пропадают. Отдельный сектор даёт случайный скин как бонус за пополнение. Платёжная система не подключается.</div>}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[26px] border border-white/10 bg-[#0a0f18] p-5">
                    <h2 className="text-xl font-black">8 бонусов Zeon</h2>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {wheel.map((item, i) => <div key={i} className="flex min-h-[105px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[.025] p-3 text-center"><Icon item={item} /><span className="mt-2 text-[10px] font-black uppercase text-slate-300">{item.label}</span></div>)}
                    </div>
                  </div>

                  {result && <div className="rounded-[26px] border border-violet-300/25 bg-violet-500/10 p-5">
                    <p className="text-xs font-black uppercase text-violet-300">Твоя награда</p>
                    <h2 className="mt-2 text-2xl font-black">{result.label}</h2>
                    {selectedCase && <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-3"><img src={selectedCase.image} alt={selectedCase.name} className="h-20 w-20 object-contain" /><div><p className="font-black">{selectedCase.name}</p><p className="text-xs text-slate-400">{selectedCase.price} Z-Coin</p></div></div>}
                    {Boolean(result.metadata?.letter) && <div className="mt-4 rounded-2xl border border-violet-300/20 bg-black/20 p-4 text-center"><p className="text-xs text-slate-400">Тебе выпала буква</p><p className="mt-1 text-4xl font-black text-violet-300">{String(result.metadata?.letter)}</p></div>}
                    <p className="mt-4 text-xs text-slate-300">Бонус сохранён за аккаунтом и будет использован по своим условиям.</p>
                  </div>}
                  {error && <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function sectorAngle(count: number) {
  return 360 / Math.max(count, 1);
}

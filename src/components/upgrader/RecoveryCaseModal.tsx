"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Item = { id: string; name: string; image: string; price: number; rarity?: string };

type Props = {
  caseId: string;
  lostValue: number;
  onClose: () => void;
  onReward?: (item: Item) => void;
};

type Stage = "closed" | "opening" | "reel" | "opened";

const REEL_MS = 4200;

export default function RecoveryCaseModal({ caseId, lostValue, onClose, onReward }: Props) {
  const [opening, setOpening] = useState(false);
  const [stage, setStage] = useState<Stage>("closed");
  const [reward, setReward] = useState<Item | null>(null);
  const [error, setError] = useState("");

  async function openCase() {
    if (opening || stage !== "closed") return;
    setOpening(true);
    setError("");

    try {
      const response = await fetch("/api/upgrader/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryCaseId: caseId, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось открыть кейс");

      setReward(data.resultItem ?? null);
      setStage("opening");
      await new Promise((resolve) => setTimeout(resolve, 650));
      setStage("reel");
      await new Promise((resolve) => setTimeout(resolve, REEL_MS));
      setStage("opened");
      if (data.resultItem) onReward?.(data.resultItem);
    } catch (e) {
      setStage("closed");
      setError(e instanceof Error ? e.message : "Ошибка открытия кейса");
    } finally {
      setOpening(false);
    }
  }

  const reelItems = useMemo(() => {
    if (!reward) return [];
    return Array.from({ length: 15 }, (_, index) => ({ ...reward, id: `${reward.id}-${index}` }));
  }, [reward]);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-violet-400/20 bg-[#0d1020] p-6 text-center shadow-[0_30px_120px_rgba(0,0,0,.65)]">
        <style>{`
          @keyframes recoveryShake { 0%,100%{transform:translateX(0) rotate(0)} 20%{transform:translateX(-5px) rotate(-1deg)} 40%{transform:translateX(6px) rotate(1deg)} 60%{transform:translateX(-4px) rotate(-1deg)} 80%{transform:translateX(3px)} }
          @keyframes recoveryLidFly { 0%{transform:translate(0,0) rotate(0);opacity:1} 100%{transform:translate(80px,-70px) rotate(22deg);opacity:0} }
          @keyframes recoveryReel { 0%{transform:translateX(0)} 100%{transform:translateX(-910px)} }
          @keyframes recoveryReward { 0%{opacity:0;transform:scale(.9) translateY(16px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
          .recovery-opening{animation:recoveryShake .65s ease-in-out both}
          .recovery-lid-opening{animation:recoveryLidFly .65s cubic-bezier(.22,.8,.22,1) forwards}
          .recovery-reel-track{animation:recoveryReel ${REEL_MS}ms cubic-bezier(.08,.78,.12,1) forwards}
          .recovery-reward{animation:recoveryReward .45s ease-out both}
        `}</style>

        <p className="text-[10px] font-black tracking-[.35em] text-violet-300">ПОСЛЕ НЕУДАЧНОГО АПГРЕЙДА</p>
        <h2 className="mt-2 text-2xl font-black">Кейс отыгрыша</h2>

        {stage === "closed" || stage === "opening" ? (
          <div className={`relative mx-auto mt-7 h-64 w-72 ${stage === "opening" ? "recovery-opening" : ""}`}>
            <Image src="/cases/recovery-body.svg" alt="Кейс отыгрыша" fill className="object-contain drop-shadow-[0_0_45px_rgba(124,58,237,.5)]" priority unoptimized />
            <Image
              src="/cases/recovery-lid.svg"
              alt="Крышка кейса"
              fill
              className={`object-contain drop-shadow-[0_0_45px_rgba(124,58,237,.45)] ${stage === "opening" ? "recovery-lid-opening" : ""}`}
              priority
              unoptimized
            />
          </div>
        ) : null}

        {stage === "reel" && reward ? (
          <div className="relative mx-auto mt-8 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#090c17] py-5">
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_18px_rgba(255,255,255,.9)]" />
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2 border-x-[10px] border-x-transparent border-t-[14px] border-t-white" />
            <div className="recovery-reel-track flex w-max gap-3 px-3">
              {reelItems.map((item) => (
                <div key={item.id} className="flex h-36 w-36 shrink-0 flex-col items-center justify-center rounded-2xl border border-violet-400/15 bg-[#12172a] p-3">
                  <div className="relative h-24 w-full"><Image src={item.image} alt={item.name} fill className="object-contain" unoptimized /></div>
                  <span className="mt-1 max-w-full truncate text-[10px] font-bold text-zinc-400">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {stage === "opened" && reward ? (
          <div className="recovery-reward mt-8 rounded-3xl border border-violet-400/15 bg-[#111525] p-6">
            <p className="text-[10px] font-black tracking-[.3em] text-zinc-500">ВАША НАГРАДА</p>
            <div className="relative mx-auto mt-4 h-44 w-full max-w-sm"><Image src={reward.image} alt={reward.name} fill className="object-contain" unoptimized /></div>
            <p className="mt-3 text-lg font-black">{reward.name}</p>
            <p className="mt-1 font-black text-[#f2b84d]">{reward.price.toFixed(2)} Z</p>
          </div>
        ) : null}

        {stage === "closed" ? (
          <>
            <p className="mt-2 text-sm text-zinc-400">Потеряно: <b className="text-[#f2b84d]">{lostValue.toFixed(2)} Z-Coin</b></p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-zinc-500">Кейс отыгрыша доступен только после проигрыша апгрейда.</p>
            <button type="button" onClick={() => void openCase()} disabled={opening} className="mt-6 w-full rounded-2xl bg-[linear-gradient(90deg,#6730df,#9138f5,#ff7f2a)] py-4 font-black tracking-[.14em] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50">ОТКРЫТЬ КЕЙС</button>
          </>
        ) : null}

        {stage === "opening" ? <p className="mt-4 text-sm font-bold text-violet-200">Открываем кейс…</p> : null}
        {stage === "reel" ? <p className="mt-4 text-sm font-bold text-violet-200">Выбираем награду…</p> : null}

        {stage === "opened" ? <button type="button" onClick={onClose} className="mt-5 w-full rounded-2xl border border-violet-400/20 bg-[#171a2b] py-4 font-black hover:bg-[#1c2035]">ЗАКРЫТЬ</button> : null}
        {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}

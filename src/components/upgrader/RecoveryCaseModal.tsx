"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Item = { id: string; name: string; image: string; price: number; rarity?: string };
type Props = { caseId: string; lostValue: number; onClose: () => void; onReward?: (item: Item) => void };
type Stage = "closed" | "opening" | "reel" | "opened";

const REEL_MS = 4200;
const CASE_IMAGE = "/cases/CaseRecovery.png";
const OPEN_CASE_IMAGE = "/cases/OpenCaseRecovery.png";
const CARD_WIDTH = 144;
const CARD_GAP = 12;
const TRACK_PADDING = 12;

function preloadImage(src?: string | null) {
  if (!src || typeof window === "undefined") return;
  const image = new window.Image();
  image.decoding = "async";
  image.src = src;
}

export default function RecoveryCaseModal({ caseId, lostValue, onClose, onReward }: Props) {
  const [opening, setOpening] = useState(false);
  const [stage, setStage] = useState<Stage>("closed");
  const [reward, setReward] = useState<Item | null>(null);
  const [reelItems, setReelItems] = useState<Item[]>([]);
  const [targetIndex, setTargetIndex] = useState(24);
  const [reelShift, setReelShift] = useState<number | null>(null);
  const [error, setError] = useState("");
  const reelViewportRef = useRef<HTMLDivElement | null>(null);
  // State updates are asynchronous. A fast double-tap can otherwise enter
  // openCase twice before `opening` becomes true, producing two different
  // idempotency keys; the first request consumes the case and the second gets
  // RECOVERY_CASE_NOT_FOUND. The ref locks the action immediately.
  const openingRef = useRef(false);

  useEffect(() => {
    for (const src of [CASE_IMAGE, OPEN_CASE_IMAGE]) preloadImage(src);
  }, []);

  useEffect(() => {
    if (stage !== "reel" || !reelViewportRef.current) return;
    const viewport = reelViewportRef.current;
    const updateShift = () => {
      const targetCenter = TRACK_PADDING + targetIndex * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH / 2;
      setReelShift(Math.round(viewport.clientWidth / 2 - targetCenter));
    };
    updateShift();
    const observer = new ResizeObserver(updateShift);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [stage, targetIndex, reelItems.length]);

  async function openCase() {
    if (openingRef.current || opening || stage !== "closed") return;
    openingRef.current = true;
    setOpening(true);
    setError("");
    setReelShift(null);
    try {
      const response = await fetch("/api/upgrader/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryCaseId: caseId, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось открыть кейс");

      const nextReward = data.resultItem ?? data.reward ?? null;
      const nextReel = Array.isArray(data.reelItems) && data.reelItems.length
        ? data.reelItems
        : nextReward
          ? Array.from({ length: 31 }, (_, i) => ({ ...nextReward, id: `${nextReward.id}-${i}` }))
          : [];
      nextReel.forEach((item: Item) => preloadImage(item.image));
      setReward(nextReward);
      setReelItems(nextReel);
      setTargetIndex(typeof data.reelTargetIndex === "number" ? data.reelTargetIndex : Math.min(24, Math.max(0, nextReel.length - 1)));
      setStage("opening");
      await new Promise((resolve) => setTimeout(resolve, 650));
      setStage("reel");
      await new Promise((resolve) => setTimeout(resolve, REEL_MS));
      setStage("opened");
      if (nextReward) onReward?.(nextReward);
    } catch (e) {
      setStage("closed");
      setError(e instanceof Error ? e.message : "Ошибка открытия кейса");
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-violet-400/20 bg-[#0d1020] p-6 text-center shadow-[0_30px_120px_rgba(0,0,0,.65)]">
        <style>{`
          @keyframes recoveryShake {0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(-5px) rotate(-1deg)}40%{transform:translateX(6px) rotate(1deg)}60%{transform:translateX(-4px) rotate(-1deg)}80%{transform:translateX(3px)}}
          @keyframes recoveryOpen {0%{transform:scale(1)}100%{transform:scale(1.05) translateY(-4px)}}
          @keyframes recoveryReel {0%{transform:translate3d(0,0,0)}100%{transform:translate3d(var(--reel-shift),0,0)}}
          @keyframes recoveryReward {0%{opacity:0;transform:scale(.9) translateY(16px)}100%{opacity:1;transform:scale(1) translateY(0)}}
          .recovery-opening{animation:recoveryShake .65s ease-in-out both}
          .recovery-case-opening{animation:recoveryOpen .65s ease-in-out both}
          .recovery-reel-track{transform:translate3d(0,0,0);will-change:transform}
          .recovery-reel-track.recovery-reel-ready{animation:recoveryReel ${REEL_MS}ms cubic-bezier(.08,.78,.12,1) forwards}
          .recovery-reward{animation:recoveryReward .45s ease-out both}
        `}</style>
        <p className="text-[10px] font-black tracking-[.35em] text-violet-300">ПОСЛЕ НЕУДАЧНОГО АПГРЕЙДА</p>
        <h2 className="mt-2 text-2xl font-black">Кейс отыгрыша</h2>

        {(stage === "closed" || stage === "opening") && (
          <div className={`relative mx-auto mt-7 h-64 w-72 ${stage === "opening" ? "recovery-opening" : ""}`}>
            <img src={stage === "opening" ? OPEN_CASE_IMAGE : CASE_IMAGE} alt="Кейс отыгрыша" className={`h-full w-full object-contain drop-shadow-[0_0_45px_rgba(124,58,237,.5)] ${stage === "opening" ? "recovery-case-opening" : ""}`} draggable={false} />
          </div>
        )}

        {stage === "reel" && reelItems.length > 0 && (
          <div ref={reelViewportRef} className="relative mx-auto mt-8 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#090c17] py-5">
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_18px_rgba(255,255,255,.9)]" />
            <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 border-x-[10px] border-x-transparent border-t-[14px] border-t-white" />
            <div
              className={`recovery-reel-track flex w-max gap-3 px-3 ${reelShift !== null ? "recovery-reel-ready" : ""}`}
              style={reelShift !== null ? ({ "--reel-shift": `${reelShift}px` } as CSSProperties) : undefined}
            >
              {reelItems.map((item, index) => (
                <div key={item.id} className={`flex h-36 w-36 shrink-0 flex-col items-center justify-center rounded-2xl border border-violet-400/15 bg-[#12172a] p-3 ${index === targetIndex ? "ring-2 ring-violet-400/40" : ""}`}>
                  <div className="relative h-24 w-full">
                    <img src={item.image} alt={item.name} width={96} height={96} className="h-24 w-full object-contain" loading="eager" decoding="sync" draggable={false} />
                  </div>
                  <span className="mt-1 max-w-full truncate text-[10px] font-bold text-zinc-400">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage === "opened" && reward && (
          <div className="recovery-reward mt-8 rounded-3xl border border-violet-400/15 bg-[#111525] p-6">
            <p className="text-[10px] font-black tracking-[.3em] text-zinc-500">ВАША НАГРАДА</p>
            <div className="relative mx-auto mt-4 h-44 w-full max-w-sm"><img src={reward.image} alt={reward.name} className="h-44 w-full object-contain" loading="eager" decoding="sync" draggable={false} /></div>
            <p className="mt-3 text-lg font-black">{reward.name}</p>
            <p className="mt-1 font-black text-[#f2b84d]">{reward.price.toFixed(2)} Z</p>
          </div>
        )}

        {stage === "closed" && <>
          <p className="mt-2 text-sm text-zinc-400">Потеряно: <b className="text-[#f2b84d]">{lostValue.toFixed(2)} Z-Coin</b></p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-zinc-500">Кейс отыгрыша доступен только после проигрыша апгрейда.</p>
          <button type="button" onClick={() => void openCase()} disabled={opening} className="mt-6 w-full rounded-2xl bg-[linear-gradient(90deg,#6730df,#9138f5,#ff7f2a)] py-4 font-black tracking-[.14em] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50">ОТКРЫТЬ КЕЙС</button>
        </>}
        {stage === "opening" && <p className="mt-4 text-sm font-bold text-violet-200">Открываем кейс…</p>}
        {stage === "reel" && <p className="mt-4 text-sm font-bold text-violet-200">Выбираем награду…</p>}
        {stage === "opened" && <button type="button" onClick={onClose} className="mt-5 w-full rounded-2xl border border-violet-400/20 bg-[#171a2b] py-4 font-black hover:bg-[#1c2035]">ЗАКРЫТЬ</button>}
        {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}

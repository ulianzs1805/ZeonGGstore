"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import DropCard from "./DropCard";
import { CARD_STEP, CARD_WIDTH, TRACK_GAP } from "../lib/roulette";
import type { CaseItem, RouletteAnimationRequest } from "../lib/types";

export type RouletteAnimationHandle = { reset: () => void };

type Props = {
  slots: CaseItem[];
  winnerIndex: number | null;
  revealWinner: boolean;
  request: RouletteAnimationRequest | null;
  resetToken: number;
  onAnimatingChange: (value: boolean) => void;
  onFinished: () => void;
};

const RouletteAnimation = forwardRef<RouletteAnimationHandle, Props>(function RouletteAnimation(
  { slots, winnerIndex, revealWinner, request, resetToken, onAnimatingChange, onFinished },
  ref,
) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const handlerRef = useRef<((event: TransitionEvent) => void) | null>(null);
  const fallbackRef = useRef<number | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const activeAnimationRef = useRef<string | null>(null);
  const finishedAnimationRef = useRef<string | null>(null);
  const finishRef = useRef(onFinished);
  const animatingRef = useRef(false);

  useEffect(() => {
    finishRef.current = onFinished;
  }, [onFinished]);

  const clearAnimationListeners = () => {
    const wheel = trackRef.current;
    if (wheel && handlerRef.current) {
      wheel.removeEventListener("transitionend", handlerRef.current);
    }
    handlerRef.current = null;
    if (fallbackRef.current !== null) {
      window.clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
  };

  const reset = () => {
    const wheel = trackRef.current;
    clearAnimationListeners();
    activeAnimationRef.current = null;
    animatingRef.current = false;
    onAnimatingChange(false);
    if (!wheel) return;
    wheel.style.transition = "none";
    wheel.style.transform = "translate3d(0,0,0)";
    void wheel.offsetWidth;
  };

  useImperativeHandle(ref, () => ({ reset }), []);

  useEffect(() => {
    reset();
    requestIdRef.current = null;
    finishedAnimationRef.current = null;
  }, [resetToken]);

  useEffect(() => {
    if (!request || !slots.length || request.id === requestIdRef.current) return;

    const wheel = trackRef.current;
    const viewport = viewportRef.current;
    if (!wheel || !viewport) return;

    const index = request.winnerIndex;
    if (index < 0 || index >= slots.length) return;

    requestIdRef.current = request.id;
    finishedAnimationRef.current = null;
    reset();
    activeAnimationRef.current = request.id;

    const viewportCenter = viewport.clientWidth / 2;
    const winnerCenter = index * CARD_STEP + CARD_WIDTH / 2;
    const target = Math.max(0, winnerCenter - viewportCenter);
    let finished = false;

    const finish = () => {
      if (finished || activeAnimationRef.current !== request.id) return;
      finished = true;
      if (finishedAnimationRef.current === request.id) return;
      finishedAnimationRef.current = request.id;
      activeAnimationRef.current = null;
      clearAnimationListeners();
      animatingRef.current = false;
      onAnimatingChange(false);
      finishRef.current();
    };

    const handler = (event: TransitionEvent) => {
      if (event.target !== wheel || event.propertyName !== "transform") return;
      finish();
    };

    handlerRef.current = handler;
    wheel.addEventListener("transitionend", handler);
    animatingRef.current = true;
    onAnimatingChange(true);

    requestAnimationFrame(() => {
      if (activeAnimationRef.current !== request.id || finished) return;
      wheel.style.transition = "transform 4300ms cubic-bezier(0.12, 0.78, 0.16, 1)";
      wheel.style.transform = `translate3d(-${target}px,0,0)`;
      fallbackRef.current = window.setTimeout(finish, 4800);
    });
  }, [request, slots.length]);

  useEffect(() => () => {
    clearAnimationListeners();
    activeAnimationRef.current = null;
    animatingRef.current = false;
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-zinc-950 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.8)] sm:p-8">
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
        <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-yellow-300" />
      </div>
      <div ref={viewportRef} className="overflow-hidden rounded-[24px] border border-white/5 bg-black/20">
        <div ref={trackRef} className="flex" style={{ gap: `${TRACK_GAP}px`, willChange: "transform" }}>
          {slots.map((item, index) => {
            const isWinner = revealWinner && winnerIndex === index;
            return (
              <div key={item.slotUid ?? `${item.id}-${index}`} style={{ opacity: revealWinner && !isWinner ? 0.28 : 1 }}>
                <DropCard item={item} winner={isWinner} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default RouletteAnimation;

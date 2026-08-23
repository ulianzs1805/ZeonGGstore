"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import DropCard from "./DropCard";
import { CARD_STEP, CARD_WIDTH } from "../lib/roulette";
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
  const resetRef = useRef(resetToken);

  useEffect(() => { finishRef.current = onFinished; }, [onFinished]);

  const clearAnimationListeners = useCallback(() => {
    const wheel = trackRef.current;
    if (wheel && handlerRef.current) wheel.removeEventListener("transitionend", handlerRef.current);
    handlerRef.current = null;
    if (fallbackRef.current !== null) {
      window.clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    const wheel = trackRef.current;
    clearAnimationListeners();
    activeAnimationRef.current = null;
    onAnimatingChange(false);
    if (!wheel) return;
    wheel.style.transition = "none";
    wheel.style.transform = "translate3d(0,0,0)";
  }, [clearAnimationListeners, onAnimatingChange]);

  useImperativeHandle(ref, () => ({ reset }), [reset]);

  useEffect(() => {
    if (resetRef.current === resetToken) return;
    resetRef.current = resetToken;
    reset();
    requestIdRef.current = null;
    finishedAnimationRef.current = null;
  }, [resetToken, reset]);

  useEffect(() => {
    if (!request || !slots.length || request.id === requestIdRef.current) return;
    const wheel = trackRef.current;
    const viewport = viewportRef.current;
    if (!wheel || !viewport) return;
    const index = request.winnerIndex;
    if (index < 0 || index >= slots.length) return;

    let cancelled = false;
    const imageUrls = Array.from(new Set(slots.map((item) => item.image).filter((src): src is string => typeof src === "string" && src.trim().length > 0)));

    const preload = async () => {
      await Promise.allSettled(
        imageUrls.map((src) => new Promise<void>((resolve) => {
          const image = new window.Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = src.trim();
        })),
      );
      if (cancelled) return;

      requestIdRef.current = request.id;
      finishedAnimationRef.current = null;
      clearAnimationListeners();
      wheel.style.transition = "none";
      wheel.style.transform = "translate3d(0,0,0)";
      void wheel.offsetWidth;
      activeAnimationRef.current = request.id;

      const target = Math.max(0, index * CARD_STEP + CARD_WIDTH / 2 - viewport.clientWidth / 2);
      let finished = false;
      const finish = () => {
        if (finished || activeAnimationRef.current !== request.id) return;
        finished = true;
        if (finishedAnimationRef.current === request.id) return;
        finishedAnimationRef.current = request.id;
        activeAnimationRef.current = null;
        clearAnimationListeners();
        onAnimatingChange(false);
        finishRef.current();
      };
      const handler = (event: TransitionEvent) => {
        if (event.target !== wheel || event.propertyName !== "transform") return;
        finish();
      };
      handlerRef.current = handler;
      wheel.addEventListener("transitionend", handler);
      onAnimatingChange(true);
      requestAnimationFrame(() => {
        if (activeAnimationRef.current !== request.id || finished) return;
        wheel.style.transition = "transform 4300ms cubic-bezier(0.12, 0.78, 0.16, 1)";
        wheel.style.transform = `translate3d(-${target}px,0,0)`;
        fallbackRef.current = window.setTimeout(finish, 4800);
      });
    };

    void preload();
    return () => { cancelled = true; };
  }, [request, slots, clearAnimationListeners, onAnimatingChange]);

  useEffect(() => () => { clearAnimationListeners(); activeAnimationRef.current = null; }, [clearAnimationListeners]);

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1018] p-2 shadow-[0_30px_80px_rgba(0,0,0,0.8)] sm:p-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-20 bg-gradient-to-b from-white/[0.025] to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-0 z-40 -translate-x-1/2"><div className="h-0 w-0 border-l-[16px] border-r-[16px] border-t-[24px] border-l-transparent border-r-transparent border-t-yellow-300 drop-shadow-[0_6px_14px_rgba(250,204,21,0.45)]" /></div>
      <div className="pointer-events-none absolute left-1/2 top-[23px] z-30 h-[calc(100%-23px)] w-px -translate-x-1/2 bg-gradient-to-b from-yellow-200/35 via-transparent to-transparent" />
      <div ref={viewportRef} className="relative min-h-[150px] overflow-hidden rounded-[24px] border border-white/[0.055] bg-black/30 py-3 sm:min-h-[176px] sm:py-5">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-[#0b1018] via-[#0b1018]/55 to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-[#0b1018] via-[#0b1018]/55 to-transparent sm:w-28" />
        <div ref={trackRef} className="flex" style={{ gap: "14px", willChange: "transform" }}>
          {slots.map((item, index) => <div key={item.slotUid ?? `${item.id}-${index}`} className="relative transition-opacity duration-300" style={{ opacity: revealWinner && winnerIndex !== index ? 0.28 : 1 }}><DropCard item={item} winner={revealWinner && winnerIndex === index} /></div>)}
        </div>
      </div>
    </div>
  );
});

export default RouletteAnimation;

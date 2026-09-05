"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import RouletteAnimation, { type RouletteAnimationHandle } from "./RouletteAnimation";
import { playCaseOpenSound, playDropSound } from "./CaseSoundEffects";
import type { CaseItem, RouletteAnimationRequest } from "../lib/types";

export type CaseRouletteHandle = { reset: () => void };

type Props = {
  slots: CaseItem[];
  winnerIndex: number | null;
  revealWinner: boolean;
  request: RouletteAnimationRequest | null;
  resetToken: number;
  onAnimatingChange: (value: boolean) => void;
  onFinished: (requestId: string) => void;
};

const CaseRoulette = forwardRef<CaseRouletteHandle, Props>(function CaseRoulette({ onFinished, request, slots, ...props }, ref) {
  const animationRef = useRef<RouletteAnimationHandle | null>(null);
  const lastRequestIdRef = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({ reset: () => animationRef.current?.reset() }), []);

  useEffect(() => {
    if (!request || request.id === lastRequestIdRef.current) return;
    lastRequestIdRef.current = request.id;
    playCaseOpenSound();
  }, [request]);

  const handleFinished = (requestId: string) => {
    const requestForSound = request?.id === requestId ? request : null;
    const drop = requestForSound ? slots[requestForSound.winnerIndex] : null;
    if (drop) playDropSound(drop.price, 0, drop.rarity);
    onFinished(requestId);
  };

  return <RouletteAnimation ref={animationRef} slots={slots} onFinished={handleFinished} request={request} {...props} />;
});

export default CaseRoulette;

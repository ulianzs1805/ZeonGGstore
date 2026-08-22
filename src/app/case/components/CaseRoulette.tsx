"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import RouletteAnimation, { type RouletteAnimationHandle } from "./RouletteAnimation";
import type { CaseItem, RouletteAnimationRequest } from "../lib/types";

export type CaseRouletteHandle = { reset: () => void };

type Props = {
  slots: CaseItem[];
  winnerIndex: number | null;
  revealWinner: boolean;
  request: RouletteAnimationRequest | null;
  resetToken: number;
  onAnimatingChange: (value: boolean) => void;
  onFinished: () => void;
};

const CaseRoulette = forwardRef<CaseRouletteHandle, Props>(function CaseRoulette(props, ref) {
  const animationRef = useRef<RouletteAnimationHandle | null>(null);
  useImperativeHandle(ref, () => ({ reset: () => animationRef.current?.reset() }), []);
  return <RouletteAnimation ref={animationRef} {...props} />;
});

export default CaseRoulette;

"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import RecoveryCaseModal from "./RecoveryCaseModal";

type Recovery = { id: string; lostValue: number; image?: string };

// The recovery operation is created when the failed upgrade is resolved on the server,
// before the client finishes the roulette + dissolve animation. Keep the modal behind
// that whole animation window so it can never cover the spinning wheel.
const RECOVERY_REVEAL_DELAY_MS = 6800;

export default function RecoveryCaseWatcher() {
  const pathname = usePathname();
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  // A GET request can finish after the user has already opened/closed the case.
  // Never resurrect that consumed recovery operation from a stale response.
  const dismissedIdRef = useRef<string | null>(null);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    pendingIdRef.current = null;
  }, []);

  const check = useCallback(async () => {
    if (pathname !== "/upgrade") return;
    try {
      const response = await fetch("/api/upgrader/recovery", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const nextRecovery = data.recoveryCase as Recovery | null;
      if (!nextRecovery) return;

      // Ignore an old in-flight GET result for a recovery case that was already
      // consumed/closed. A newer recovery gets a new id and is still accepted.
      if (dismissedIdRef.current === nextRecovery.id) return;
      if (pendingIdRef.current === nextRecovery.id || recovery?.id === nextRecovery.id) return;

      pendingIdRef.current = nextRecovery.id;
      revealTimerRef.current = window.setTimeout(() => {
        if (dismissedIdRef.current === nextRecovery.id) return;
        setRecovery(nextRecovery);
        revealTimerRef.current = null;
      }, RECOVERY_REVEAL_DELAY_MS);
    } catch {
      // The upgrader remains usable if the recovery check fails.
    }
  }, [pathname, recovery?.id]);

  useEffect(() => {
    if (pathname !== "/upgrade") {
      clearRevealTimer();
      setRecovery(null);
      return;
    }

    void check();
    const timer = window.setInterval(() => void check(), 2500);
    return () => {
      window.clearInterval(timer);
      clearRevealTimer();
    };
  }, [pathname, check, clearRevealTimer]);

  if (pathname !== "/upgrade" || !recovery) return null;

  return (
    <RecoveryCaseModal
      key={recovery.id}
      caseId={recovery.id}
      lostValue={recovery.lostValue}
      onClose={() => {
        dismissedIdRef.current = recovery.id;
        clearRevealTimer();
        setRecovery(null);
      }}
    />
  );
}

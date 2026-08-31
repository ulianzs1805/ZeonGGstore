"use client";

import { useEffect, useState } from "react";
import RecoveryCaseModal from "@/components/upgrader/RecoveryCaseModal";

type RecoveryCase = { id: string; lostValue: number; image?: string };
type Reward = { id: string; name: string; image: string; price: number; rarity?: string };

// The upgrade result animation is ~4.2s. Recovery must not cover it before the drop reaches the result.
const RECOVERY_DELAY_MS = 4400;

export default function RecoveryCaseWatcher() {
  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingId: string | null = null;

    const check = async () => {
      try {
        const response = await fetch("/api/upgrader/recovery", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          const next = data.recoveryCase as RecoveryCase | null;

          if (active && next && next.id !== dismissedId && next.id !== pendingId && !recoveryCase) {
            pendingId = next.id;
            revealTimer = setTimeout(() => {
              if (!active) return;
              setRecoveryCase(next);
              pendingId = null;
            }, RECOVERY_DELAY_MS);
          }

          if (active && !next) {
            if (revealTimer) clearTimeout(revealTimer);
            pendingId = null;
            setRecoveryCase(null);
          }
        }
      } catch {
        // Recovery UI must never break the upgrader if polling fails.
      } finally {
        if (active) pollTimer = setTimeout(check, 1200);
      }
    };

    void check();
    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [dismissedId, recoveryCase]);

  if (!recoveryCase) return null;

  return (
    <RecoveryCaseModal
      caseId={recoveryCase.id}
      lostValue={Number(recoveryCase.lostValue) || 0}
      onReward={(_reward: Reward) => undefined}
      onClose={() => {
        setDismissedId(recoveryCase.id);
        setRecoveryCase(null);
        window.location.reload();
      }}
    />
  );
}

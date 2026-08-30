"use client";

import { useEffect, useState } from "react";
import RecoveryCaseModal from "@/components/upgrader/RecoveryCaseModal";

type RecoveryCase = { id: string; lostValue: number; image?: string };

type Reward = { id: string; name: string; image: string; price: number; rarity?: string };

export default function RecoveryCaseWatcher() {
  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      try {
        const response = await fetch("/api/upgrader/recovery", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          const next = data.recoveryCase as RecoveryCase | null;
          if (active && next && next.id !== dismissedId) setRecoveryCase(next);
          if (active && !next) setRecoveryCase(null);
        }
      } catch {
        // Recovery UI must never break the upgrader if the polling request fails.
      } finally {
        if (active) timer = setTimeout(check, 1200);
      }
    };

    void check();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [dismissedId]);

  if (!recoveryCase) return null;

  return (
    <RecoveryCaseModal
      caseId={recoveryCase.id}
      lostValue={Number(recoveryCase.lostValue) || 0}
      onReward={(_reward: Reward) => undefined}
      onClose={() => {
        setDismissedId(recoveryCase.id);
        setRecoveryCase(null);
      }}
    />
  );
}

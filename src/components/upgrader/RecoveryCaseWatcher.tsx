"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import RecoveryCaseModal from "./RecoveryCaseModal";

type Recovery = { id: string; lostValue: number; image?: string };

export default function RecoveryCaseWatcher() {
  const pathname = usePathname();
  const [recovery, setRecovery] = useState<Recovery | null>(null);

  const check = useCallback(async () => {
    if (pathname !== "/upgrade") return;
    try {
      const response = await fetch("/api/upgrader/recovery", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (data.recoveryCase) setRecovery(data.recoveryCase);
    } catch {
      // The upgrader remains usable if the recovery check fails.
    }
  }, [pathname]);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), 2500);
    return () => window.clearInterval(timer);
  }, [check]);

  if (pathname !== "/upgrade" || !recovery) return null;

  return (
    <RecoveryCaseModal
      caseId={recovery.id}
      lostValue={recovery.lostValue}
      onClose={() => setRecovery(null)}
    />
  );
}

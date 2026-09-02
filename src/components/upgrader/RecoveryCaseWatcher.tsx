"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import RecoveryCaseModal from "./RecoveryCaseModal";

type Recovery = { id: string; lostValue: number; image?: string };
const READY_EVENT = "zeon-upgrade-recovery-ready";
const READY_KEY = "zeon-upgrade-recovery-ready";

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
    if (pathname !== "/upgrade") {
      setRecovery(null);
      return;
    }

    const reveal = () => {
      sessionStorage.setItem(READY_KEY, "1");
      void check();
      window.setTimeout(() => void check(), 600);
    };

    window.addEventListener(READY_EVENT, reveal);
    if (sessionStorage.getItem(READY_KEY) === "1") reveal();

    return () => window.removeEventListener(READY_EVENT, reveal);
  }, [pathname, check]);

  if (pathname !== "/upgrade" || !recovery) return null;

  return (
    <RecoveryCaseModal
      caseId={recovery.id}
      lostValue={recovery.lostValue}
      onClose={() => setRecovery(null)}
    />
  );
}

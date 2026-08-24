"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getRarityTextClass } from "@/lib/rarity-styles";

const BEST_DROP_KEY = "zeon_best_drop_v1";
const STORE_UPDATE_EVENT = "zeon-store-updated";

type RecentDrop = {
  id: string;
  name: string;
  rarity: string;
  color: string;
  image: string;
  caseId?: string;
  caseName?: string;
  caseImage?: string;
  userName?: string | null;
  slotUid?: string;
};

function readBestDropId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BEST_DROP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
}

export default function RecentDropsStrip({ title = "Последние дропы" }: { title?: string }) {
  const [drops, setDrops] = useState<RecentDrop[]>([]);
  const [bestDropId, setBestDropId] = useState<string | null>(null);
  const [toggledCaseIds, setToggledCaseIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const sync = async () => {
      try {
        const response = await fetch("/api/recent-drops", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.text();
        const data = body ? JSON.parse(body) as { drops?: Array<{ id: string; itemId?: string; name: string; rarity: string; image: string; userName?: string | null; case?: { slug: string; name: string; image: string } | null }> } : {};
        setDrops((data.drops ?? []).map((drop) => ({ id: drop.itemId ?? drop.id, name: drop.name, rarity: drop.rarity, image: drop.image, color: getRarityTextClass(drop.rarity), caseId: drop.case?.slug, caseName: drop.case?.name, caseImage: drop.case?.image, userName: drop.userName })));
      } catch {
        // Keep the last successful feed visible during a transient API failure.
      }
      setBestDropId(readBestDropId());
    };

    void sync();
    const refreshTimer = window.setInterval(() => void sync(), 10000);
    window.addEventListener("storage", sync);
    window.addEventListener(STORE_UPDATE_EVENT, sync);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("storage", sync);
      window.removeEventListener(STORE_UPDATE_EVENT, sync);
    };
  }, []);

  const visibleDrops = useMemo(() => {
    if (bestDropId) {
      const best = drops.find((drop) => drop.id === bestDropId);
      const others = drops.filter((drop) => drop.id !== bestDropId);
      if (best) return [best, ...others].slice(0, 7);
    }
    return drops.slice(0, 7);
  }, [drops, bestDropId]);

  const hiddenCount = Math.max(0, drops.length - 7);
  const gradientOpacity = Math.min(1, Math.max(0.3, hiddenCount * 0.15));
  const toggleCaseView = (dropId: string) => setToggledCaseIds((current) => ({ ...current, [dropId]: !current[dropId] }));

  return <div className="rounded-[18px] border border-white/10 bg-[#0b1017]/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
    <div className="mb-2 flex items-center justify-between gap-2 text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-slate-400"><span>{title}</span></div>
    {drops.length > 0 ? <div className="relative w-full"><div className="overflow-hidden rounded-xl"><div className="flex gap-2.5 transition-transform duration-300 ease-out">
      {visibleDrops.map((drop, index) => {
        const isHistoricalBest = drop.id === bestDropId;
        const resolvedCase = drop.caseId ? { caseId: drop.caseId, caseImage: drop.caseImage ?? drop.image } : null;
        const shouldShowCaseImage = Boolean(resolvedCase && toggledCaseIds[drop.id]);
        const caseHref = resolvedCase ? `/case?caseId=${encodeURIComponent(resolvedCase.caseId)}` : "/case";
        return <div key={`${drop.id}-${drop.slotUid ?? index}`} className={["flex w-[150px] shrink-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-all duration-300 ease-out hover:border-violet-400/60 hover:bg-white/[0.04]", isHistoricalBest ? "border-yellow-400/50 bg-yellow-400/[0.06] shadow-[0_0_0_1px_rgba(250,204,21,0.22),0_0_24px_rgba(250,204,21,0.12)]" : "border-white/8 bg-white/[0.02]"].join(" ")}>
          <div className={["relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border bg-[#0d1523]", isHistoricalBest ? "h-10 w-10 border-yellow-400/60" : "border-violet-500/30"].join(" ")}>
            <div className="relative h-full w-full">
              <button type="button" aria-label={`Открыть ${drop.caseName ?? "кейс"}`} className={["absolute inset-0 z-10 transition-all duration-300 ease-out", shouldShowCaseImage ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"].join(" ")} onClick={() => { window.location.href = caseHref; }}>
                {resolvedCase ? <Image src={resolvedCase.caseImage} alt={drop.caseName ?? drop.name} fill className="object-contain" sizes="32px" unoptimized /> : null}
              </button>
              <button type="button" aria-label={`Показать кейс ${drop.name}`} className={["absolute inset-0 z-0 transition-all duration-300 ease-out", shouldShowCaseImage ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"].join(" ")} onClick={() => toggleCaseView(drop.id)}>
                <Image src={drop.image} alt={drop.name} fill className="object-contain" sizes="32px" unoptimized />
              </button>
            </div>
          </div>
          <div className="min-w-0 flex-1"><p className={["truncate text-[0.5rem] font-medium uppercase tracking-[0.12em]", isHistoricalBest ? "text-yellow-300" : drop.color].join(" ")}>{isHistoricalBest ? "Best" : drop.rarity}</p><p className="truncate text-xs font-semibold text-slate-100" title={drop.name}>{drop.name}</p><p className="truncate text-[0.48rem] text-slate-500" title={`${drop.userName ?? "Игрок"} · ${drop.caseName ?? "Кейс"}`}>{drop.userName ?? "Игрок"} · {drop.caseName ?? "Кейс"}</p></div>
        </div>;
      })}
    </div></div>{hiddenCount > 0 && <div className="pointer-events-none absolute inset-y-0 right-0 w-16 rounded-r-xl bg-gradient-to-l from-[#0b1017]/90 to-transparent transition-opacity duration-300" style={{ opacity: gradientOpacity }} />}</div> : <p className="text-xs text-slate-400">Дропы появятся после первого открытия кейса.</p>}
  </div>;
}

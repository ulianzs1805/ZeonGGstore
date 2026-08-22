"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";
import { getRarityTextClass } from "@/lib/rarity-styles";
import BestDrop from "./components/BestDrop";
import CaseDropList from "./components/CaseDropList";
import CaseRoulette from "./components/CaseRoulette";
import WinnerModal from "./components/WinnerModal";
import { buildRouletteSlots, scoreDrop } from "./lib/roulette";
import type { CaseItem, CatalogCase, CatalogDrop, RouletteAnimationRequest } from "./lib/types";

const RECENT_DROPS_KEY = "zeon_recent_drops_v1";
const BEST_DROP_KEY = "zeon_best_drop_v1";
const STORE_UPDATE_EVENT = "zeon-store-updated";

const readRecentDrops = (): CaseItem[] => {
  try {
    const raw = localStorage.getItem(RECENT_DROPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.name !== "AK-47 Skin" && item?.name !== "Knife Skin" && item?.image !== "/skins/default.png") : [];
  } catch { return []; }
};

const writeRecentDrops = (items: CaseItem[]) => {
  const fresh = items.filter((item) => !item.timestamp || Date.now() - item.timestamp < 604800000).slice(0, 50);
  localStorage.setItem(RECENT_DROPS_KEY, JSON.stringify(fresh));
  window.dispatchEvent(new Event(STORE_UPDATE_EVENT));
};

const readBestDrop = (): CaseItem | null => {
  try {
    const raw = localStorage.getItem(BEST_DROP_KEY);
    const item = raw ? JSON.parse(raw) : null;
    return item?.name === "AK-47 Skin" || item?.name === "Knife Skin" || item?.image === "/skins/default.png" ? null : item;
  } catch { return null; }
};

const writeBestDrop = (item: CaseItem | null) => {
  if (item) localStorage.setItem(BEST_DROP_KEY, JSON.stringify(item));
  else localStorage.removeItem(BEST_DROP_KEY);
  window.dispatchEvent(new Event(STORE_UPDATE_EVENT));
};

export default function CasePage() {
  const [catalog, setCatalog] = useState<CatalogCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [winner, setWinner] = useState<CaseItem | null>(null);
  const [openError, setOpenError] = useState("");
  const [resultVisible, setResultVisible] = useState(false);
  const [resultClosing, setResultClosing] = useState(false);
  const [resultAction, setResultAction] = useState<"inventory" | "sell" | null>(null);
  const [rouletteSlots, setRouletteSlots] = useState<CaseItem[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [revealWinner, setRevealWinner] = useState(false);
  const [bestDrop, setBestDrop] = useState<CaseItem | null>(null);
  const [expandedChanceCardId, setExpandedChanceCardId] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [animationRequest, setAnimationRequest] = useState<RouletteAnimationRequest | null>(null);
  const [resetToken, setResetToken] = useState(0);

  const catalogRef = useRef<CatalogCase[]>([]);
  const activeCase = catalog.find((item) => item.slug === selectedCaseId || item.id === selectedCaseId) ?? null;
  const caseSkins: CaseItem[] = activeCase?.drops.map((drop) => ({
    id: drop.id,
    name: drop.name,
    rarity: drop.rarity,
    color: getRarityTextClass(drop.rarity),
    image: drop.image,
    price: drop.price,
    chance: drop.probability,
    caseId: activeCase.slug,
    caseImage: activeCase.image,
  })) ?? [];

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("caseId");
    setSelectedCaseId(requested);
    void fetch(`/api/cases?version=${Date.now()}`, { cache: "no-store", credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить каталог кейсов");
        return response.json();
      })
      .then((data: { cases?: CatalogCase[] }) => {
        const next = Array.isArray(data.cases) ? data.cases : [];
        catalogRef.current = next;
        setCatalog(next);
        if (!requested) setSelectedCaseId(next[0]?.slug ?? null);
      })
      .catch((error: unknown) => setOpenError(error instanceof Error ? error.message : "Не удалось загрузить каталог кейсов"));
  }, []);

  useEffect(() => {
    if (caseSkins.length && !opening && !animationRequest) setRouletteSlots(buildRouletteSlots(caseSkins).slots);
  }, [caseSkins.length, activeCase?.id, opening, animationRequest]);

  useEffect(() => {
    const sync = () => setBestDrop(readBestDrop());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(STORE_UPDATE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(STORE_UPDATE_EVENT, sync);
    };
  }, []);

  const finishRoll = () => {
    const index = animationRequest?.winnerIndex;
    if (index === undefined || index === null || !rouletteSlots[index]) return;
    const rollWinner = rouletteSlots[index];
    setAnimationRequest(null);
    setWinnerIndex(index);
    setRevealWinner(true);
    setWinner(rollWinner);
    setResultVisible(true);
    setOpening(false);
    setAnimating(false);
    window.dispatchEvent(new Event("zeon-profile-updated"));
  };

  const startCaseRoll = async () => {
    if (opening || animating) return;
    let currentCatalog = catalogRef.current;
    if (!currentCatalog.length) {
      try {
        const response = await fetch(`/api/cases?version=${Date.now()}`, { cache: "no-store", credentials: "include" });
        const data = await response.json().catch(() => null) as { cases?: CatalogCase[]; error?: string } | null;
        if (!response.ok || !Array.isArray(data?.cases)) throw new Error(data?.error || "Не удалось загрузить каталог кейсов");
        currentCatalog = data.cases;
        catalogRef.current = currentCatalog;
        setCatalog(currentCatalog);
      } catch (error) {
        setOpenError(error instanceof Error ? error.message : "Не удалось загрузить каталог кейсов");
        return;
      }
    }

    const requested = selectedCaseId ?? new URLSearchParams(window.location.search).get("caseId");
    const currentCase = currentCatalog.find((item) => item.slug === requested || item.id === requested) ?? currentCatalog[0] ?? null;
    const currentSkins: CaseItem[] = currentCase?.drops.map((drop) => ({
      id: drop.id, name: drop.name, rarity: drop.rarity, color: getRarityTextClass(drop.rarity), image: drop.image,
      price: drop.price, chance: drop.probability, caseId: currentCase.slug, caseImage: currentCase.image,
    })) ?? [];

    if (!currentCase || !currentSkins.length) {
      setOpenError("Кейс ещё загружается. Попробуй через секунду.");
      return;
    }

    if (selectedCaseId !== currentCase.slug) setSelectedCaseId(currentCase.slug);
    setOpening(true);
    setOpenError("");
    setResultVisible(false);
    setResultClosing(false);
    setRevealWinner(false);
    setWinnerIndex(null);
    setWinner(null);
    setResultAction(null);
    setAnimating(false);
    setAnimationRequest(null);
    setResetToken((value) => value + 1);

    const provisional = buildRouletteSlots(currentSkins);
    if (!provisional.winner) {
      setOpening(false);
      setOpenError("В кейсе нет доступного дропа");
      return;
    }
    setRouletteSlots(provisional.slots);

    try {
      const response = await fetch("/api/cases/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ caseId: currentCase.id, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.drop || !data?.item) throw new Error(data?.error || "Не удалось открыть кейс");

      const serverDrop = data.drop as CatalogDrop;
      const rollWinner: CaseItem = {
        id: serverDrop.id,
        name: serverDrop.name,
        rarity: serverDrop.rarity,
        color: getRarityTextClass(serverDrop.rarity),
        image: serverDrop.image,
        price: serverDrop.price,
        chance: serverDrop.probability,
        caseId: currentCase.slug,
        caseImage: currentCase.image,
        inventoryItemId: data.item.id,
      };

      const stableSlots = provisional.slots.map((slot, index) => index === provisional.winnerSlotIndex ? { ...rollWinner, slotUid: slot.slotUid } : slot);
      setRouletteSlots(stableSlots);
      setAnimationRequest({ id: crypto.randomUUID(), winnerIndex: provisional.winnerSlotIndex });
    } catch (error) {
      setOpening(false);
      setAnimating(false);
      setAnimationRequest(null);
      setResetToken((value) => value + 1);
      setOpenError(error instanceof Error ? error.message : "Не удалось открыть кейс");
    }
  };

  const closeResult = () => {
    setResultClosing(true);
    window.setTimeout(() => {
      setResultVisible(false);
      setResultClosing(false);
      setWinner(null);
      setRevealWinner(false);
      setWinnerIndex(null);
      setResultAction(null);
      setAnimationRequest(null);
      setResetToken((value) => value + 1);
      if (caseSkins.length) setRouletteSlots(buildRouletteSlots(caseSkins).slots);
    }, 250);
  };

  const handleResultAction = async (action: "inventory" | "sell") => {
    if (!winner) return;
    setResultAction(action);
    if (action === "sell") {
      try {
        const response = await fetch("/api/inventory/sell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ inventoryItemId: winner.inventoryItemId }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Не удалось продать предмет");
        window.dispatchEvent(new Event("zeon-profile-updated"));
      } catch (error) {
        setOpenError(error instanceof Error ? error.message : "Не удалось продать предмет");
        setResultAction(null);
        return;
      }
    }
    closeResult();
  };

  const handleOpenAgain = () => {
    if (resultClosing || opening || animating) return;
    setResultClosing(false);
    setResultVisible(false);
    setWinner(null);
    setRevealWinner(false);
    setWinnerIndex(null);
    setResultAction(null);
    setAnimationRequest(null);
    setResetToken((value) => value + 1);
    requestAnimationFrame(() => void startCaseRoll());
  };

  useEffect(() => {
    if (!winner || !resultVisible) return;
    const resolved = { ...winner, timestamp: Date.now() };
    writeRecentDrops([resolved, ...readRecentDrops()]);
    const current = readBestDrop();
    writeBestDrop(!current || scoreDrop(winner) >= scoreDrop(current) ? winner : current);
  }, [winner, resultVisible]);

  const activeCaseName = activeCase?.name ?? "Загрузка кейса...";

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition-transform duration-200 hover:scale-105 active:scale-95">← Назад</Link>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">ZEONGGSTORE</p>
          <h1 className="mt-3 break-words text-3xl font-black sm:text-5xl">{activeCaseName}</h1>
          <p className="mt-4 text-gray-400">Открой кейс и попробуй получить редкий предмет.</p>
        </div>
        <div className="mt-10"><RecentDropsStrip title="Последние дропы" /></div>
        <BestDrop bestDrop={bestDrop} />
        <div className="mt-12 sm:mt-16">
          <CaseRoulette
            slots={rouletteSlots}
            winnerIndex={winnerIndex}
            revealWinner={revealWinner}
            request={animationRequest}
            resetToken={resetToken}
            onAnimatingChange={setAnimating}
            onFinished={finishRoll}
          />
        </div>
        {!resultVisible && (
          <div className="mt-10 text-center">
            {openError && <p className="mb-4 text-sm font-semibold text-red-300">{openError}</p>}
            <button type="button" onClick={() => void startCaseRoll()} disabled={opening || animating} aria-busy={opening || animating} className="group relative overflow-hidden rounded-2xl bg-yellow-400 px-10 py-4 text-lg font-black text-black shadow-[0_0_30px_rgba(250,204,21,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-300 hover:shadow-[0_0_42px_rgba(250,204,21,0.38)] active:translate-y-0 active:scale-95 disabled:cursor-wait disabled:opacity-70">
              {(opening || animating) && <span className="absolute inset-y-0 left-[-40%] w-2/5 -skew-x-12 bg-white/35 blur-md animate-[shimmer_900ms_linear_infinite]" />}
              <span className="relative">{opening || animating ? "Открываем..." : "Открыть кейс"}</span>
            </button>
          </div>
        )}
        {winner && resultVisible && <WinnerModal winner={winner} resultClosing={resultClosing} resultAction={resultAction} onAction={handleResultAction} onOpenAgain={handleOpenAgain} />}
        <CaseDropList activeCase={activeCase} expandedChanceCardId={expandedChanceCardId} onToggle={(id) => setExpandedChanceCardId((current) => current === id ? null : id)} />
      </div>
    </main>
  );
}

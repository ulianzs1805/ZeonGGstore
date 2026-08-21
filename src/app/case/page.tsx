"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";
import { getRarityCardClass, getRarityTextClass } from "@/lib/rarity-styles";

type CaseItem = {
  id: string;
  name: string;
  rarity: string;
  color: string;
  image: string;
  price: number;
  chance: number;
  caseId?: string;
  caseImage?: string;
  inventoryItemId?: string;
  slotUid?: string;
  timestamp?: number;
};

type CatalogDrop = { id: string; name: string; rarity: string; image: string; price: number; probability: number };
type CatalogCase = { id: string; slug: string; name: string; image: string; price: number; isActive: boolean; drops: CatalogDrop[] };

const TRACK_GAP = 14;
const SLOT_COUNT = 24;
const CARD_WIDTH = 180;
const CARD_STEP = CARD_WIDTH + TRACK_GAP;
const RECENT_DROPS_KEY = "zeon_recent_drops_v1";
const BEST_DROP_KEY = "zeon_best_drop_v1";
const STORE_UPDATE_EVENT = "zeon-store-updated";

function readRecentDrops(): CaseItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_DROPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const current = Array.isArray(parsed) ? parsed.filter((item) => item?.name !== "AK-47 Skin" && item?.name !== "Knife Skin" && item?.image !== "/skins/default.png") : [];
    if (current.length !== parsed.length) window.localStorage.setItem(RECENT_DROPS_KEY, JSON.stringify(current));
    return current;
  } catch {
    return [];
  }
}

function writeRecentDrops(items: CaseItem[]) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const fresh = items.filter((item) => !item.timestamp || now - item.timestamp < weekMs).slice(0, 50);
  window.localStorage.setItem(RECENT_DROPS_KEY, JSON.stringify(fresh));
  window.dispatchEvent(new Event(STORE_UPDATE_EVENT));
}

function readBestDrop(): CaseItem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BEST_DROP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.name === "AK-47 Skin" || parsed?.name === "Knife Skin" || parsed?.image === "/skins/default.png") {
      window.localStorage.removeItem(BEST_DROP_KEY);
      return null;
    }
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeBestDrop(item: CaseItem | null) {
  if (typeof window === "undefined") return;
  if (!item) window.localStorage.removeItem(BEST_DROP_KEY);
  else window.localStorage.setItem(BEST_DROP_KEY, JSON.stringify(item));
  window.dispatchEvent(new Event(STORE_UPDATE_EVENT));
}

const getHistoricDropScore = (item: CaseItem) => {
  switch (item.rarity) {
    case "ARCANE": return 1000;
    case "Legendary":
    case "LEGENDARY": return 900;
    case "Epic":
    case "EPIC": return 700;
    case "Rare": return 600;
    case "Uncommon": return 400;
    default: return 200;
  }
};

const resolveHistoricBestDrop = (candidate: CaseItem | null, currentBest: CaseItem | null) => {
  if (!candidate) return currentBest;
  if (!currentBest) return candidate;
  return getHistoricDropScore(candidate) >= getHistoricDropScore(currentBest) ? candidate : currentBest;
};

const pickWeightedRandom = (items: CaseItem[]) => {
  const totalChance = items.reduce((sum, item) => sum + item.chance, 0);
  let point = Math.random() * totalChance;
  for (const item of items) {
    point -= item.chance;
    if (point <= 0) return item;
  }
  return items[items.length - 1];
};

const buildRouletteSlots = (items: CaseItem[], serverWinner?: CaseItem) => {
  const winner = serverWinner ?? pickWeightedRandom(items);
  const winnerSlotIndex = 10 + Math.floor(Math.random() * 6);
  const uidBase = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) => ({
    ...(index === winnerSlotIndex ? winner : pickWeightedRandom(items)),
    slotUid: `${uidBase}-${index}`,
  }));
  return { slots, winner, winnerSlotIndex, winnerSlotUid: `${uidBase}-${winnerSlotIndex}` };
};

export default function CasePage() {
  const [catalog, setCatalog] = useState<CatalogCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const activeCase = catalog.find((item) => item.slug === selectedCaseId || item.id === selectedCaseId) ?? null;
  const caseSkins = activeCase?.drops.map((drop) => ({ id: drop.id, name: drop.name, rarity: drop.rarity, color: getRarityTextClass(drop.rarity), image: drop.image, price: drop.price, chance: drop.probability, caseId: activeCase.slug, caseImage: activeCase.image })) ?? [];
  const [opening, setOpening] = useState(false);
  const [winner, setWinner] = useState<CaseItem | null>(null);
  const [openError, setOpenError] = useState("");
  const [resultVisible, setResultVisible] = useState(false);
  const [resultClosing, setResultClosing] = useState(false);
  const [resultAction, setResultAction] = useState<"inventory" | "sell" | "open-again" | null>(null);
  const [rouletteSlots, setRouletteSlots] = useState<CaseItem[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [revealWinner, setRevealWinner] = useState(false);
  const [bestDrop, setBestDrop] = useState<CaseItem | null>(null);
  const [expandedChanceCardId, setExpandedChanceCardId] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [animating, setAnimating] = useState(false);

  const isRollingRef = useRef(false);
  const wheelTrackRef = useRef<HTMLDivElement | null>(null);
  const transitionHandlerRef = useRef<((event: Event) => void) | null>(null);
  const fallbackRef = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedCaseId = params.get("caseId");
    setSelectedCaseId(requestedCaseId);
    void fetch(`/api/cases?version=${Date.now()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить каталог кейсов");
        return response.json();
      })
      .then((data: { cases?: CatalogCase[] }) => {
        const nextCatalog = Array.isArray(data.cases) ? data.cases : [];
        setCatalog(nextCatalog);
        if (!requestedCaseId) setSelectedCaseId(nextCatalog[0]?.slug ?? null);
      })
      .catch((error: unknown) => setOpenError(error instanceof Error ? error.message : "Не удалось загрузить каталог кейсов"));
  }, []);

  useEffect(() => {
    if (!caseSkins.length || isRollingRef.current) return;
    setRouletteSlots(buildRouletteSlots(caseSkins).slots);
  }, [caseSkins.length, activeCase?.id]);

  useEffect(() => {
    const syncBest = () => setBestDrop(readBestDrop());
    syncBest();
    window.addEventListener("storage", syncBest);
    window.addEventListener(STORE_UPDATE_EVENT, syncBest);
    return () => {
      window.removeEventListener("storage", syncBest);
      window.removeEventListener(STORE_UPDATE_EVENT, syncBest);
    };
  }, []);

  const finishRoll = (rollWinner: CaseItem, index: number) => {
    if (!isRollingRef.current) return;
    isRollingRef.current = false;
    if (fallbackRef.current) window.clearTimeout(fallbackRef.current);
    fallbackRef.current = null;
    setAnimating(false);
    setScrollOffset(0);
    setWinnerIndex(index);
    setRevealWinner(true);
    setWinner(rollWinner);
    setResultVisible(true);
    setOpening(false);
    window.dispatchEvent(new Event("zeon-profile-updated"));
  };

  const startCaseRoll = async () => {
    if (isRollingRef.current || opening) return;
    if (!activeCase || !caseSkins.length) {
      setOpenError("Кейс ещё загружается. Попробуй через секунду.");
      return;
    }

    // Lock synchronously before any await so the first tap cannot be lost or duplicated.
    isRollingRef.current = true;
    setOpening(true);
    setOpenError("");
    setResultVisible(false);
    setResultClosing(false);
    setRevealWinner(false);
    setWinnerIndex(null);

    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/cases/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: activeCase.id, idempotencyKey }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.drop || !data?.item) {
        throw new Error(data?.error || "Не удалось открыть кейс");
      }

      const serverDrop = data.drop as CatalogDrop;
      const rollWinner: CaseItem = {
        id: serverDrop.id,
        name: serverDrop.name,
        rarity: serverDrop.rarity,
        color: getRarityTextClass(serverDrop.rarity),
        image: serverDrop.image,
        price: serverDrop.price,
        chance: serverDrop.probability,
        caseId: activeCase.slug,
        caseImage: activeCase.image,
        inventoryItemId: data.item.id,
      };
      const roll = buildRouletteSlots(caseSkins, rollWinner);
      setRouletteSlots(roll.slots);
      setWinner(null);
      setAnimating(true);

      requestAnimationFrame(() => {
        const wheel = wheelTrackRef.current;
        if (!wheel) {
          finishRoll(rollWinner, roll.winnerSlotIndex);
          return;
        }
        if (transitionHandlerRef.current) wheel.removeEventListener("transitionend", transitionHandlerRef.current);
        wheel.style.transition = "none";
        wheel.style.transform = "translateX(0px)";
        void wheel.offsetWidth;

        const target = roll.winnerSlotIndex * CARD_STEP - CARD_STEP * 2;
        const handler = (event: Event) => {
          if (event.target !== wheel || event.type !== "transitionend") return;
          wheel.removeEventListener("transitionend", handler);
          finishRoll(rollWinner, roll.winnerSlotIndex);
        };
        transitionHandlerRef.current = handler;
        wheel.addEventListener("transitionend", handler);

        requestAnimationFrame(() => {
          wheel.style.transition = "transform 3100ms cubic-bezier(0.12, 0.78, 0.2, 1)";
          wheel.style.transform = `translateX(-${target}px)`;
          fallbackRef.current = window.setTimeout(() => finishRoll(rollWinner, roll.winnerSlotIndex), 3600);
        });
      });
    } catch (error) {
      isRollingRef.current = false;
      setOpening(false);
      setAnimating(false);
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
    if (resultClosing) return;
    setResultVisible(false);
    setWinner(null);
    setRevealWinner(false);
    setWinnerIndex(null);
    requestAnimationFrame(() => void startCaseRoll());
  };

  const activeCaseName = activeCase?.name ?? "Загрузка кейса...";

  useEffect(() => {
    if (!winner || !resultVisible) return;
    const resolved = { ...winner, timestamp: Date.now() };
    writeRecentDrops([resolved, ...readRecentDrops()]);
    const nextBest = resolveHistoricBestDrop(winner, readBestDrop());
    writeBestDrop(nextBest);
  }, [winner, resultVisible]);

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-yellow-400/40 hover:text-white" aria-label="Вернуться на главную">
            <span className="text-lg">←</span><span>Назад</span>
          </Link>
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">ZEONGGSTORE</p>
          <h1 className="mt-3 text-5xl font-black">{activeCaseName}</h1>
          <p className="mt-4 text-gray-400">Открой кейс и попробуй получить редкий предмет.</p>
        </div>

        <div className="mt-10"><RecentDropsStrip title="Последние дропы" /></div>

        {bestDrop && (
          <div className="mt-6 rounded-[26px] border border-yellow-400/40 bg-zinc-950 p-5">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-yellow-300">Лучший дроп</p>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-20 w-20"><Image src={bestDrop.image} alt={bestDrop.name} fill className="object-contain" sizes="80px" unoptimized /></div>
              <div><h3 className="text-2xl font-black">{bestDrop.name}</h3><p className="text-sm text-slate-300">{bestDrop.price} Z Coin · исторический рекорд</p></div>
            </div>
          </div>
        )}

        <div className="relative mt-16 overflow-hidden rounded-[30px] border border-white/10 bg-zinc-950 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.8)]">
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2"><div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-yellow-300" /></div>
          <div className="overflow-hidden rounded-[24px] border border-white/5 bg-black/20">
            <div ref={wheelTrackRef} className="flex" style={{ gap: `${TRACK_GAP}px`, transform: animating ? undefined : `translateX(-${scrollOffset}px)` }}>
              {rouletteSlots.map((item, index) => {
                const isWinner = revealWinner && winnerIndex === index;
                return (
                  <div key={item.slotUid ?? `${item.id}-${index}`} className={["flex min-w-[180px] flex-col items-center rounded-[22px] border-2 p-4 backdrop-blur-sm", getRarityCardClass(item.rarity), isWinner ? "ring-1 ring-yellow-300/40" : ""].join(" ")} style={{ opacity: revealWinner && !isWinner ? 0.28 : 1 }}>
                    <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[18px]"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="112px" unoptimized /></div>
                    <h3 className={`mt-3 text-center font-black ${item.color}`}>{item.name}</h3>
                    <p className="mt-1 text-[11px] font-medium uppercase text-slate-200/80">{item.rarity}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {!resultVisible && (
          <div className="mt-10 text-center">
            {openError && <p className="mb-4 text-sm font-semibold text-red-300">{openError}</p>}
            <button type="button" onClick={() => void startCaseRoll()} disabled={opening || !activeCase || !caseSkins.length} className="rounded-2xl bg-yellow-400 px-10 py-4 text-lg font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">
              {opening ? "Открываем..." : "Открыть кейс"}
            </button>
          </div>
        )}

        {winner && resultVisible && (
          <div className={["mt-8 rounded-3xl border border-yellow-400/20 bg-zinc-950/90 p-6 transition-all", resultClosing ? "opacity-0" : "opacity-100"].join(" ")}>
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-5"><div className="relative h-24 w-24"><Image src={winner.image} alt={winner.name} fill className="object-contain" sizes="96px" unoptimized /></div><div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-400">Твой дроп</p><h3 className="mt-2 text-2xl font-black">{winner.name}</h3><p className={`mt-1 text-sm font-semibold ${winner.color}`}>{winner.rarity}</p><p className="mt-1 text-sm text-gray-400">{winner.price} Z Coin</p></div></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void handleResultAction("inventory")} disabled={resultClosing} className="rounded-2xl bg-yellow-400 px-6 py-3 text-sm font-black text-black">{resultAction === "inventory" ? "Добавляем..." : "Добавить в инвентарь"}</button>
                <button type="button" onClick={() => void handleResultAction("sell")} disabled={resultClosing} className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white">{resultAction === "sell" ? "Продаём..." : `Продать за ${winner.price} Z Coin`}</button>
              </div>
              <button type="button" onClick={handleOpenAgain} disabled={resultClosing} className="rounded-2xl border border-yellow-400/30 bg-zinc-900 px-6 py-3 text-sm font-bold text-yellow-300">Открыть ещё</button>
            </div>
          </div>
        )}

        <section className="mt-12 rounded-[28px] border border-white/8 bg-[#0b1017]/80 p-6">
          <div className="mb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-yellow-400">Содержимое кейса</p><h2 className="mt-3 text-3xl font-black text-white">Возможные дропы</h2><p className="mt-2 text-sm text-slate-400">Нажми на картинку оружия, чтобы посмотреть шанс выпадения</p></div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {caseSkins.map((item) => {
              const expanded = expandedChanceCardId === item.id;
              return <button key={item.id} type="button" onClick={() => setExpandedChanceCardId(expanded ? null : item.id)} className="rounded-[22px] border border-white/8 bg-[#0d131b] p-4 text-left transition hover:border-white/20">
                <div className="relative h-32 overflow-hidden rounded-[18px]"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="140px" unoptimized /></div>
                <p className={`mt-3 text-[10px] font-semibold uppercase ${item.color}`}>{item.rarity}</p><h3 className="mt-1 text-sm font-black text-white">{item.name}</h3>
                {expanded && <p className="mt-3 text-sm font-semibold text-yellow-300">Шанс выпадения: {item.chance}%</p>}
              </button>;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

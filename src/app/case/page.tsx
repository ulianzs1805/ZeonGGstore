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
  timestamp?: number; // ISO timestamp for auto-cleanup
};

type CatalogDrop = { id: string; name: string; rarity: string; image: string; price: number; probability: number };
type CatalogCase = { id: string; slug: string; name: string; image: string; price: number; isActive: boolean; drops: CatalogDrop[] };

// RollEntry diagnostics removed — no longer needed.

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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecentDrops(items: CaseItem[]) {
  if (typeof window === "undefined") return;

  // Auto-cleanup: remove drops older than 7 days
  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const fresh = items.filter((item) => {
    if (!item.timestamp) return true; // Keep items without timestamp
    return now - item.timestamp < WEEK_MS;
  });

  // Limit to max 50 items
  const limited = fresh.slice(0, 50);

  window.localStorage.setItem(RECENT_DROPS_KEY, JSON.stringify(limited));
  window.dispatchEvent(new Event(STORE_UPDATE_EVENT));
}

function readBestDrop(): CaseItem | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(BEST_DROP_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeBestDrop(item: CaseItem | null): CaseItem | null { return item; }

function writeBestDrop(item: CaseItem | null) {
  if (typeof window === "undefined") return;

  if (!item) {
    window.localStorage.removeItem(BEST_DROP_KEY);
    window.dispatchEvent(new Event(STORE_UPDATE_EVENT));
    return;
  }

  window.localStorage.setItem(BEST_DROP_KEY, JSON.stringify(item));
  window.dispatchEvent(new Event(STORE_UPDATE_EVENT));
}

const getHistoricDropScore = (item: CaseItem) => {
  switch (item.rarity) {
    case "ARCANE":
      return 1000;
    case "Legendary":
    case "LEGENDARY":
      return 900;
    case "Epic":
    case "EPIC":
      return 700;
    case "Rare":
      return 600;
    case "Uncommon":
      return 400;
    default:
      return 200;
  }
};

const resolveHistoricBestDrop = (candidate: CaseItem | null, currentBest: CaseItem | null) => {
  if (!candidate) return currentBest;
  if (!currentBest) return candidate;

  return getHistoricDropScore(candidate) >= getHistoricDropScore(currentBest) ? candidate : currentBest;
};

const pickWeightedRandom = (items: CaseItem[]) => {
  const totalChance = items.reduce((sum, item) => sum + item.chance, 0);
  const randomPoint = Math.random() * totalChance;

  let current = 0;

  for (const item of items) {
    current += item.chance;
    if (randomPoint <= current) {
      return item;
    }
  }

  return items[items.length - 1];
};

const buildRouletteSlots = (items: CaseItem[], serverWinner?: CaseItem) => {
  const winner = serverWinner ?? pickWeightedRandom(items);
  const winnerSlotIndex = 10 + Math.floor(Math.random() * 6);

  const uidBase = `${Date.now().toString(36)}-${Math.floor(Math.random()*1000)}`;
  const slots: CaseItem[] = Array.from({ length: SLOT_COUNT }, (_, index) => {
    const base = index === winnerSlotIndex ? winner : pickWeightedRandom(items);
    return { ...base, slotUid: `${uidBase}-${index}` };
  });

  if (!slots.length) {
    return {
      slots: [...items],
      winner,
      winnerSlotIndex: 0,
      winnerSlotUid: null,
    };
  }

  return { slots, winner, winnerSlotIndex, winnerSlotUid: `${uidBase}-${winnerSlotIndex}` };
};

export default function CasePage() {
  const [catalog, setCatalog] = useState<CatalogCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const activeCase = catalog.find((item) => item.slug === selectedCaseId || item.id === selectedCaseId) ?? null;
  const caseSkins = activeCase?.drops.map((drop) => ({ id: drop.id, name: drop.name, rarity: drop.rarity, color: getRarityTextClass(drop.rarity), image: drop.image, price: drop.price, chance: drop.probability, caseId: activeCase.slug, caseImage: activeCase.image })) ?? [];
  const activeCaseName = activeCase?.name ?? "Загрузка кейса...";

  const [opening, setOpening] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [revealWinner, setRevealWinner] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [winner, setWinner] = useState<CaseItem | null>(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultClosing, setResultClosing] = useState(false);
  const [resultAction, setResultAction] = useState<"inventory" | "sell" | "open-again" | null>(null);
  const [rouletteSlots, setRouletteSlots] = useState<CaseItem[]>([]);
  const [bestDrop, setBestDrop] = useState<CaseItem | null>(null);
  const [expandedChanceCardId, setExpandedChanceCardId] = useState<string | null>(null);
  const [openError, setOpenError] = useState("");

  const trackRef = useRef<HTMLDivElement | null>(null);
  const wheelTrackRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const rollFallbackTimeoutRef = useRef<number | null>(null);
  const pendingOpenRef = useRef<Promise<{ drop: CatalogDrop; item: { id: string } }> | null>(null);
  const userOpenKeyRef = useRef<string>(`open-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  // Refs to hold the prepared next roll data without making it visible
  const nextSlotsRef = useRef<CaseItem[] | null>(null);
  const nextWinnerRef = useRef<CaseItem | null>(null);
  const nextWinnerIndexRef = useRef<number | null>(null);
  const isRollingRef = useRef(false);
  const transitionWheelRef = useRef<HTMLElement | null>(null);
  // Roll id to distinguish transitionend events between rolls
  const rollIdRef = useRef(0);
  // Keep reference to the current transitionend handler so we can remove it
  const transitionHandlerRef = useRef<((ev: Event) => void) | null>(null);
  // Accumulated offset across rolls to ensure we never animate backwards.
  const totalOffsetRef = useRef(0);
  // Flag to tell render to avoid React-controlled transform/transition while
  // an imperative animation runs on the wheel DOM element. This prevents
  // intermediate renders from changing transform/transition mid-animation.
  const animatingRef = useRef(false);
  // State-backed indicator so JSX can reliably switch behavior while an
  // imperative animation is active. Using state ensures a re-render so the
  // inline style in React won't overwrite DOM writes during the animation.
  const [animating, setAnimating] = useState(false);

  // Load the active case and its drops from the Prisma-backed catalog API.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requestedCaseId = params.get("caseId");
    setSelectedCaseId(requestedCaseId);
    void fetch("/api/cases", { cache: "no-store" }).then((response) => response.json()).then((data: { cases?: CatalogCase[] }) => {
      const nextCatalog = Array.isArray(data.cases) ? data.cases : [];
      setCatalog(nextCatalog);
      if (!requestedCaseId) setSelectedCaseId(nextCatalog[0]?.slug ?? null);
    }).catch(() => setOpenError("Не удалось загрузить каталог кейсов"));
  }, []);

  // Initialize roulette slots only on client side to avoid hydration mismatch
  useEffect(() => {
    if (!caseSkins.length) return;
    const initialRoll = buildRouletteSlots(caseSkins);
    setRouletteSlots(initialRoll.slots);

    const storedBest = readBestDrop();
    const normalizedBest = normalizeBestDrop(storedBest);
    setBestDrop(normalizedBest);

    if (storedBest?.id !== normalizedBest?.id || storedBest?.name !== normalizedBest?.name) {
      writeBestDrop(normalizedBest);
    }
  }, [caseSkins.length, activeCase?.id]);

  useEffect(() => {
    const syncBestDrop = () => {
      const storedBest = readBestDrop();
      setBestDrop(normalizeBestDrop(storedBest));
    };
    syncBestDrop();
    window.addEventListener("storage", syncBestDrop);
    window.addEventListener(STORE_UPDATE_EVENT, syncBestDrop);

    return () => {
      window.removeEventListener("storage", syncBestDrop);
      window.removeEventListener(STORE_UPDATE_EVENT, syncBestDrop);
    };
  }, []);

  useEffect(() => {
    if (!winner || !resultVisible) return;

    const currentList = readRecentDrops();
    const resolvedWinner = {
      ...winner,
      caseId: winner.caseId ?? selectedCaseId ?? undefined,
      caseImage: winner.caseImage ?? activeCase?.image,
      timestamp: Date.now(), // Add timestamp for auto-cleanup
    };
    // Add new drop to the beginning, shift others right
    // Auto-cleanup and max limit handled in writeRecentDrops
    const nextList = [resolvedWinner, ...currentList];

    if (currentList.length === nextList.length && currentList.every((item, index) => item.id === nextList[index]?.id)) {
      return;
    }

    writeRecentDrops(nextList);

    const currentBest = readBestDrop();
    const nextBest = resolveHistoricBestDrop(winner, currentBest);

    if (currentBest?.id !== nextBest?.id || currentBest?.name !== nextBest?.name) {
      writeBestDrop(nextBest);
    }
  }, [winner, resultVisible]);

  const getSellPrice = (item: CaseItem) => {
    return item.price;
  };

  const closeResultState = async (mode: "inventory" | "sell" | "open-again") => {
    if (!winner && mode !== "open-again") return;
    setResultAction(mode);
    // If user explicitly added to inventory, close immediately so the
    // main "Открыть кейс" button becomes available without waiting.
    // For other actions keep the small UX delay.
    if (mode === "inventory") {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }

      setResultVisible(false);
      setResultClosing(false);
      setResultAction(null);
      setWinner(null);
      setRevealWinner(false);
      setWinnerIndex(null);

      const resetRoll = buildRouletteSlots(caseSkins);
      setResetting(true);
      setRouletteSlots(resetRoll.slots);
      setScrollOffset(0);

      requestAnimationFrame(() => {
        setResetting(false);
      });
      return;
    }

    if (mode === "sell" && winner?.inventoryItemId) {
      const response = await fetch("/api/inventory/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryItemId: winner.inventoryItemId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        window.alert(data?.error || "Не удалось продать предмет");
        setResultAction(null);
        return;
      }
      window.dispatchEvent(new Event("zeon-profile-updated"));
    }

    if (rollFallbackTimeoutRef.current) {
      window.clearTimeout(rollFallbackTimeoutRef.current);
      rollFallbackTimeoutRef.current = null;
    }

    setResultClosing(true);
    // clear any existing close timer
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setResultVisible(false);
      setResultClosing(false);
      setResultAction(null);
      setWinner(null);
      setRevealWinner(false);
      setWinnerIndex(null);

      const resetRoll = buildRouletteSlots(caseSkins);
      setResetting(true);
      setRouletteSlots(resetRoll.slots);
      setScrollOffset(0);

      requestAnimationFrame(() => {
        setResetting(false);
      });

      closeTimeoutRef.current = null;
    }, 500);
  };

  const releaseRollLock = () => {
    isRollingRef.current = false;
    setOpening(false);
    setResetting(false);

    if (rollFallbackTimeoutRef.current) {
      window.clearTimeout(rollFallbackTimeoutRef.current);
      rollFallbackTimeoutRef.current = null;
    }
  };

  const handleResultAction = (action: "inventory" | "sell") => {
    void closeResultState(action);
  };

  const handleOpenAgain = () => {
    // Immediately hide the result panel and reset visual winner state,
    // then start a new roll on the next animation frame so the user
    // doesn't need to press the main open button.
    if (resultClosing) return;

    // clear any pending close timer to avoid it clearing state mid-autostart
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    // Hide the old result; the next result is authorized by the backend.
    setResultVisible(false);
    setResultClosing(false);
    setResultAction(null);
    setRevealWinner(false);

    requestAnimationFrame(() => requestAnimationFrame(() => startCaseRoll()));
  };

  const startCaseRoll = async () => {

    // Prevent concurrent starts
    if (isRollingRef.current || opening || resetting || resultVisible) return;
    isRollingRef.current = true;
    setOpenError("");
    userOpenKeyRef.current = `open-${crypto.randomUUID()}`;

    const previewResponse = await fetch("/api/cases/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: selectedCaseId, preview: true }),
    }).catch(() => null);
    if (!previewResponse) {
      setOpenError("Не удалось проверить баланс");
      isRollingRef.current = false;
      return;
    }
    const previewData = await previewResponse.json().catch(() => null);
    if (!previewResponse.ok) {
      setOpenError(previewData?.error || "Не удалось проверить баланс");
      isRollingRef.current = false;
      return;
    }

    const openRequest = fetch("/api/cases/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: selectedCaseId, idempotencyKey: `${userOpenKeyRef.current}` }),
    }).then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Не удалось открыть кейс");
      return data as { drop: CatalogDrop; item: { id: string } };
    });
    pendingOpenRef.current = openRequest;

    // Do not mutate the visible `winner` state yet. The next winner may be
    // prepared in refs by `handleOpenAgain` or will be created here. We only
    // make the winner visible after the wheel finishes (on transitionend).
    setRevealWinner(false);
    setResultVisible(false);
    setResultClosing(false);

    

    let nextSlots: CaseItem[] | null = null;
    let nextWinnerIndex: number | null = null;
    let nextWinner: CaseItem | null = null;

    let authoritativeResult: { drop: CatalogDrop; item: { id: string } };
    try {
      authoritativeResult = await openRequest;
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : "Не удалось открыть кейс");
      isRollingRef.current = false;
      pendingOpenRef.current = null;
      return;
    }
    const visualWinner = caseSkins.find((item) => item.id === authoritativeResult.drop.id);
    if (!visualWinner) {
      setOpenError("Сервер вернул предмет, которого нет в выбранном кейсе.");
      isRollingRef.current = false;
      pendingOpenRef.current = null;
      return;
    }
    const nextRoll = buildRouletteSlots(caseSkins, visualWinner);
    if (!nextRoll.slots.length) {
      isRollingRef.current = false;
      return;
    }
    nextSlots = [...nextRoll.slots];
    nextWinnerIndex = nextRoll.winnerSlotIndex;
    nextWinner = nextRoll.winner;
    nextSlotsRef.current = nextSlots;
    nextWinnerRef.current = nextWinner;
    nextWinnerIndexRef.current = nextWinnerIndex;
    ((nextSlotsRef as unknown) as { winnerSlotUid?: string | null }).winnerSlotUid = nextRoll.winnerSlotUid ?? null;

    // capture authoritative prepared winner UID for this roll so we can
    // expose it on the wheel element for external verification.
    const preparedWinnerSlotUid = ((nextSlotsRef as unknown) as { winnerSlotUid?: string | null }).winnerSlotUid ?? null;

    setOpening(true);
    // Ensure slots are set (atomic replacement already done in handleOpenAgain),
    // but set again here to cover the case where startCaseRoll built them.
    
    // set the new slots into state; this is the single source of DOM content
    setRouletteSlots(nextSlots);
    // reset scrollOffset state to 0 explicitly as our model uses absolute transforms per-roll
    setScrollOffset(0);

    // Ensure the DOM has been updated with the new `rouletteSlots` before
    // measuring card positions. Use a double rAF to wait for the next paint.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const viewport = trackRef.current;
        const wheel = wheelTrackRef.current;

        if (!viewport || !wheel) {
          releaseRollLock();
          return;
        }

          const cards = Array.from(
            wheel.querySelectorAll<HTMLElement>('[data-case-card="true"]'),
          );

          if (cards.length === 0) {
            releaseRollLock();
            return;
          }


          

          // Deterministic calculation of target scroll based on winnerIndex.
          // Use the actual DOM bounding box of the winner card for accuracy
          // instead of relying on the CARD_STEP constant which can drift
          // due to styling, scaling or rounding.
          const winnerIndexForCalc = nextWinnerIndex as number;
          // Prefer locating winner DOM by slotUid when available (more robust)
          const wheelRect = wheel.getBoundingClientRect();
          // Prefer the actual marker element's center when available. This
          // ensures the geometry we compare card centers against matches the
          // visual indicator (the yellow/black marker) rather than assuming
          // the viewport center.
          let rouletteCenter: number;
          if (markerRef.current) {
            const mr = markerRef.current.getBoundingClientRect();
            rouletteCenter = mr.left + mr.width / 2;
          } else {
            rouletteCenter = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
          }

          // Find the corresponding card element and measure its center.
          // Find winnerCard by slotUid first; fallback to index
          let winnerCard: HTMLElement | undefined;
          if (preparedWinnerSlotUid) {
            winnerCard = cards.find(c => c.getAttribute('key') === preparedWinnerSlotUid || c.getAttribute('data-slot-uid') === preparedWinnerSlotUid) as HTMLElement | undefined;
          }
          if (!winnerCard) {
            winnerCard = cards[winnerIndexForCalc];
          }
          // local center estimate inside wheel (fallback & for debug)
          const winnerCenterLocal = winnerIndexForCalc * CARD_STEP + CARD_WIDTH / 2;
          let winnerCenterAbs: number;
          if (winnerCard) {
            const cardRect = winnerCard.getBoundingClientRect();
            winnerCenterAbs = cardRect.left + cardRect.width / 2;
          } else {
            // Fallback to previous calculation if card not found
            winnerCenterAbs = wheelRect.left + winnerCenterLocal;
          }

          // Compute desired scroll offset so that winnerCenterAbs sits at rouletteCenter.
          // Use absolute measured coordinates directly. Avoid using `scrollLeft` or
          // `clientLeft` which don't apply here (we're translating the track).
          const target = Math.max(0, winnerCenterAbs - rouletteCenter);

          // Start each roll from a per-roll zero offset. Do NOT nudge the
          // geometry artificially; we rely on measured DOM coordinates only.
          setResetting(true);
          setScrollOffset(0);

          // Dev-only debug info
        

          if (wheel) {
            // Remove previous handler if it was attached to a previous wheel
            if (transitionHandlerRef.current && transitionWheelRef.current) {
                try {
                    transitionWheelRef.current.removeEventListener("transitionend", transitionHandlerRef.current);
                  } catch {
                    // ignore
                  }
              transitionHandlerRef.current = null;
              transitionWheelRef.current = null;
            }

            // assign a new roll id for this animation
            rollIdRef.current += 1;
            const myRollId = rollIdRef.current;

            

            const onTransitionEnd = (ev: Event) => {
              const te = ev as TransitionEvent;
              // Relaxed checks: accept the event if propertyName is missing
              // or is 'transform'. Use currentTarget to ensure the listener
              // was attached to the wheel element rather than requiring the
              // event target to equal the element (some browsers emit the
              // event from a child or with empty propertyName).
              if (te.propertyName && te.propertyName !== "transform") return;
              if (ev.currentTarget !== wheel) return;

              // Ensure this event is for the current roll
              if (myRollId !== rollIdRef.current) return;

              // Clean up the listener
              try {
                wheel.removeEventListener("transitionend", onTransitionEnd);
              } catch {
              }
              transitionHandlerRef.current = null;
              transitionWheelRef.current = null;

              // Diagnostic: log transitionend
              try {
                // eslint-disable-next-line no-console
                console.log(`[DIAG roll=${myRollId}] transitionend`, {
                  time: Date.now(),
                  transform: window.getComputedStyle(wheel).transform,
                  transition: wheel.style.transition || window.getComputedStyle(wheel).transition,
                  scrollOffset,
                  totalOffset: totalOffsetRef.current,
                  resetting,
                  target,
                });
              } catch {
                // ignore
              }

              if (rollFallbackTimeoutRef.current) {
                window.clearTimeout(rollFallbackTimeoutRef.current);
                rollFallbackTimeoutRef.current = null;
              }

              // Now that the wheel stopped, determine which card is actually
              // centered and use that as the authoritative visual winner.
              try {
                let rouletteCenterNow: number;
                if (markerRef.current) {
                  const mrNow = markerRef.current.getBoundingClientRect();
                  rouletteCenterNow = mrNow.left + mrNow.width / 2;
                } else {
                  const viewportNow = viewport.getBoundingClientRect();
                  rouletteCenterNow = viewportNow.left + viewportNow.width / 2;
                }
                const cardsNow = Array.from(wheel.querySelectorAll<HTMLElement>('[data-case-card="true"]'));
                let nearestIdxNow = -1; let minD = Infinity;
                cardsNow.forEach((c, idx) => {
                  const r = c.getBoundingClientRect();
                  const center = r.left + r.width / 2;
                  const d = Math.abs(center - rouletteCenterNow);
                  if (d < minD) { minD = d; nearestIdxNow = idx; }
                });

                const nearestCard = cardsNow[nearestIdxNow];
                if (nearestCard) {
                  const slotUid = nearestCard.getAttribute('data-slot-uid') ?? nearestCard.getAttribute('key');
                  const authoritativeSlots = nextSlotsRef.current ?? rouletteSlots;
                  const match = authoritativeSlots.find(s => s.slotUid === slotUid) ?? nextWinnerRef.current;
                  const indexInSlots = authoritativeSlots.findIndex(s => s.slotUid === (match?.slotUid ?? slotUid));

                  const nearestCards = cardsNow.slice(Math.max(0, nearestIdxNow - 1), Math.min(cardsNow.length, nearestIdxNow + 2)).map((card) => {
                    const rect = card.getBoundingClientRect();
                    return {
                      slotUid: card.getAttribute('data-slot-uid') ?? null,
                      name: (card.querySelector('h3')?.textContent || '').trim() || null,
                      left: rect.left,
                      centerX: rect.left + rect.width / 2,
                      right: rect.right,
                    };
                  });

                  const visualWinnerName = (nearestCard.querySelector('h3')?.textContent || '').trim() || null;
                  const logicalWinnerUid = match?.slotUid ?? nextWinnerRef.current?.slotUid ?? null;
                  const logicalWinnerName = match?.name ?? nextWinnerRef.current?.name ?? null;

                  // eslint-disable-next-line no-console
                  console.log('[WINNER_DIAG]', {
                    rollId: myRollId,
                    markerCenterX: rouletteCenterNow,
                    target,
                    totalOffset: totalOffsetRef.current,
                    visualWinnerUid: slotUid,
                    visualWinnerName,
                    logicalWinnerUid,
                    logicalWinnerName,
                    winnerBeingSetUid: logicalWinnerUid,
                    winnerBeingSetName: logicalWinnerName,
                    nearestCards,
                  });

                  if (match) {
                    setWinner(match);
                    setWinnerIndex(indexInSlots === -1 ? nextWinnerIndexRef.current : indexInSlots);
                  } else {
                    setWinner(nextWinnerRef.current);
                    setWinnerIndex(nextWinnerIndexRef.current);
                  }
                } else {
                  setWinner(nextWinnerRef.current);
                  setWinnerIndex(nextWinnerIndexRef.current);
                }
              } catch {
                setWinner(nextWinnerRef.current);
                setWinnerIndex(nextWinnerIndex);
              }

              // Accumulate the completed movement into `totalOffsetRef` while
              // disabling transitions so the immediate reset to per-roll zero
              // offset doesn't produce a visual jump. This guarantees the
              // effective transform (`totalOffset + scrollOffset`) only ever
              // increases between rolls.
              try {
                setResetting(true);
                totalOffsetRef.current += target;
                setScrollOffset(0);
              } catch {
                // ignore
              }

              // Stop imperative animation mode and ensure the DOM and React
              // rendered styles agree. Clear the inline transition so React's
              // next render can control the element without a visual jump.
              animatingRef.current = false;
              try { setAnimating(false); } catch {}

              try {
                // ensure final transform matches the accumulated offset and stays
                // stable before we reveal the winner. This avoids the final-frame
                // jerk that happened when the winner was set in the same tick as
                // the transform was being rewritten.
                wheel.style.transition = "none";
                wheel.style.transform = `translateX(-${totalOffsetRef.current}px)`;
                wheel.style.willChange = "transform";
              } catch {
                // ignore
              }

              // Ensure any temporary 'resetting' state applied during
              // offset accumulation is cleared so the main action button
              // becomes available again.
              try { setResetting(false); } catch {}

              void pendingOpenRef.current?.then((result) => {
                const confirmedWinner: CaseItem = {
                  ...result.drop,
                  color: getRarityTextClass(result.drop.rarity),
                  price: result.drop.price,
                  chance: result.drop.probability,
                  inventoryItemId: result.item.id,
                  caseId: selectedCaseId ?? undefined,
                  caseImage: activeCase?.image,
                };
                setWinner(confirmedWinner);
                setWinnerIndex(nextWinnerIndexRef.current);
                requestAnimationFrame(() => {
                  setRevealWinner(true);
                  setResultVisible(true);
                  setOpening(false);
                  isRollingRef.current = false;
                  pendingOpenRef.current = null;
                  nextSlotsRef.current = null;
                  nextWinnerRef.current = null;
                  nextWinnerIndexRef.current = null;
                });
              }).catch((error: unknown) => {
                setOpenError(error instanceof Error ? error.message : "Не удалось открыть кейс");
                setOpening(false);
                isRollingRef.current = false;
                pendingOpenRef.current = null;
              });

            };

            // Remove previous transitionend listener if it exists to avoid stale handlers
            if (transitionWheelRef.current && transitionHandlerRef.current) {
              transitionWheelRef.current.removeEventListener("transitionend", transitionHandlerRef.current);
            }

            transitionHandlerRef.current = onTransitionEnd;
            transitionWheelRef.current = wheel;
            wheel.addEventListener("transitionend", onTransitionEnd);

            

            // Next paint: enable transition and perform the animation
            // imperatively on the wheel DOM element to avoid React re-renders
            // toggling transform/transition mid-flight.
            requestAnimationFrame(() => {
              // Use flushSync to ensure the DOM is updated with transition style
              // BEFORE we set the transform imperatively
              flushSync(() => setResetting(false));

              // Mark that an imperative animation will run and set up the
              // transition/transform directly on the element. Avoid using
              // setScrollOffset(target) here because React re-renders can
              // overwrite the inline style during the animation.
              animatingRef.current = true;
              // ensure React knows we are animating so JSX won't reapply styles
              // mid-flight (use state for reliable re-render)
              try { setAnimating(true); } catch {}

              // small rAF to ensure transition property applied to the DOM
              requestAnimationFrame(() => {
                try {
                  // apply the transition and target transform imperatively
                  wheel.style.transition = "transform 3100ms cubic-bezier(0.12, 0.78, 0.2, 1)";
                  wheel.style.transform = `translateX(-${totalOffsetRef.current + target}px)`;
                  if (rollFallbackTimeoutRef.current) {
                    window.clearTimeout(rollFallbackTimeoutRef.current);
                  }
                  rollFallbackTimeoutRef.current = window.setTimeout(() => {
                    if (isRollingRef.current) wheel.dispatchEvent(new Event("transitionend"));
                  }, 3500);
                  // eslint-disable-next-line no-console
                  console.log(`[DIAG roll=${myRollId}] applied transform`, {
                    time: Date.now(),
                    transform: wheel.style.transform,
                    transition: wheel.style.transition,
                    scrollOffset,
                    totalOffset: totalOffsetRef.current,
                    resetting,
                    target,
                  });
                } catch (e) {
                  // ignore DOM write errors
                }
              });
            });
          }
      });
    });
  };

    


  // Log renders and DOM children count for debugging reconciliation issues
  useEffect(() => {
    // no-op effect kept for potential future hooks; intentionally empty
  }, [rouletteSlots, scrollOffset]);
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-yellow-400/40 hover:text-white"
            aria-label="Вернуться на главную"
          >
            <span className="text-lg">←</span>
            <span>Назад</span>
          </Link>
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
            ZEONGGSTORE
          </p>
          <h1 className="mt-3 text-5xl font-black">{activeCaseName}</h1>
          <p className="mt-4 text-gray-400">
            Открой кейс и попробуй получить редкий предмет.
          </p>
        </div>

        <div className="mt-10">
          <RecentDropsStrip title="Последние дропы" />
        </div>

        {bestDrop && (
          <div className="mt-6 rounded-[26px] border border-yellow-400/40 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.14),_rgba(12,16,22,0.96)_45%,_rgba(2,6,23,1)_100%)] p-5 shadow-[0_0_0_1px_rgba(250,204,21,0.18),0_0_30px_rgba(250,204,21,0.12)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-yellow-300">Лучший дроп</p>
              <span className="rounded-full border border-yellow-300/40 bg-yellow-400/10 px-2 py-1 text-[0.56rem] font-bold uppercase tracking-[0.18em] text-yellow-200">
                Best Drop
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-[18px] border border-yellow-300/50 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.16),rgba(8,11,18,0.82)_45%,rgba(2,6,23,0.96)_100%)] shadow-[0_0_22px_rgba(250,204,21,0.18)]">
                <Image
                  src={bestDrop.image}
                  alt={bestDrop.name}
                  fill
                  className="object-contain"
                  sizes="80px"
                  unoptimized
                />
              </div>

              <div className="min-w-0">
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-yellow-200">{bestDrop.rarity}</p>
                <h3 className="mt-1 text-2xl font-black text-white">{bestDrop.name}</h3>
                <p className="mt-1 text-sm text-slate-300">{getSellPrice(bestDrop)} Z Coin · исторический рекорд</p>
              </div>
            </div>
          </div>
        )}

        <div className="relative mt-16 overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(32,35,42,0.92),_rgba(11,13,18,0.98)_38%,_rgba(4,5,9,1)_100%)] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_24px_rgba(168,85,247,0.08)]">
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
            <div
              ref={markerRef}
              className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-yellow-300 opacity-95 drop-shadow-[0_0_18px_rgba(250,204,21,0.8)]"
            />
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
            <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-b-[14px] border-l-transparent border-r-transparent border-b-yellow-300 opacity-95 drop-shadow-[0_0_18px_rgba(250,204,21,0.8)]" />
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white/5 bg-black/20 shadow-[inset_0_0_26px_rgba(0,0,0,0.9)]" ref={trackRef}>
            <div
              ref={wheelTrackRef}
              className="flex"
              style={{
                gap: `${TRACK_GAP}px`,
                // When an imperative animation is running we intentionally
                // avoid React-controlled transform/transition so DOM writes
                // performed in startCaseRoll are not overwritten mid-flight.
                ...(animating
                  ? {}
                  : {
                      transform: `translateX(-${totalOffsetRef.current + scrollOffset}px)`,
                      transition: resetting
                        ? "none"
                        : "transform 3100ms cubic-bezier(0.12, 0.78, 0.2, 1)",
                    }),
              }}
            >
              {rouletteSlots.map((item, index) => {
                const isWinner = revealWinner && winnerIndex !== null && index === winnerIndex;
                const shouldDim = revealWinner && winnerIndex !== null && !isWinner;
                const rarityClass = getRarityCardClass(item.rarity);

                return (
                  <div
                    key={item.slotUid ?? `${item.id}-${index}`}
                    data-case-card="true"
                    data-slot-uid={item.slotUid ?? undefined}
                    className={[
                      "flex min-w-[180px] flex-col items-center rounded-[22px] border-2 p-4 backdrop-blur-sm",
                      rarityClass,
                      isWinner ? "ring-1 ring-yellow-300/40" : "",
                    ].join(" ")}
                    style={{
                      // winner: no background, no border; only subtle lift + glow on image
                      opacity: isWinner ? 1 : shouldDim ? 0.28 : 0.82,
                      filter: shouldDim ? "saturate(0.5) brightness(0.45)" : "saturate(0.9) brightness(0.9)",
                      // subtle lift for winner to visually emphasize it
                      transform: isWinner ? "translateY(-6px) scale(1.06)" : shouldDim ? "translateY(0) scale(0.92)" : "translateY(0) scale(1)",
                      zIndex: isWinner ? 20 : 1,
                      transition: "all 700ms ease",
                    }}
                  >
                    <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[18px] border border-white/8 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.12),rgba(9,10,14,0.8)_38%,rgba(2,6,23,0.94)_100%)]">
                      {/* soft radial glow behind the image for winner only */}
                      {isWinner && (
                        <div
                          aria-hidden
                          className="absolute inset-0 m-0 rounded-full"
                          style={{
                            background: "radial-gradient(circle at 50% 40%, rgba(250,204,21,0.26), rgba(250,204,21,0.08) 28%, rgba(250,204,21,0.00) 55%)",
                            filter: "blur(10px)",
                            pointerEvents: "none",
                            // clip the glow inside the image container
                            mixBlendMode: 'screen',
                          }}
                        />
                      )}

                      <div className={isWinner ? 'relative z-10 flex h-full w-full items-center justify-center' : 'relative h-full w-full'}>
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className={isWinner ? "object-contain scale-[1.08] brightness-110" : "object-contain scale-[1.12] bg-transparent"}
                          sizes="112px"
                          unoptimized
                        />
                      </div>
                    </div>

                    <h3
                      className={`mt-3 text-center font-black ${item.color} ${
                        isWinner ? "text-base" : "text-sm"
                      }`}
                    >
                      {item.name}
                    </h3>

                    <p className="mt-1 text-[11px] font-medium tracking-[0.16em] text-slate-200/80 uppercase">{item.rarity}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {!resultVisible && (
          <div className="mt-10 text-center">
            {openError && <p className="mb-4 text-sm font-semibold text-red-300">{openError}</p>}
            <button
              type="button"
              onClick={startCaseRoll}
              disabled={opening || resetting || !activeCase}
              className="rounded-2xl bg-yellow-400 px-10 py-4 text-lg font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {opening ? "Открываем..." : "Открыть кейс"}
            </button>
          </div>
        )}

        {winner && resultVisible && (
          <div
            className={[
              "mt-8 rounded-3xl border border-yellow-400/20 bg-zinc-950/90 p-6 shadow-[0_0_40px_rgba(250,204,21,0.15)] transition-all duration-500",
              resultClosing ? "translate-y-2 scale-[0.98] opacity-0" : "translate-y-0 scale-100 opacity-100",
            ].join(" ")}
          >
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-5">
                <div className="relative h-24 w-24 overflow-visible bg-transparent p-0">
                  <Image
                    src={winner.image}
                    alt={winner.name}
                    fill
                    className="object-contain bg-transparent"
                    sizes="96px"
                    unoptimized
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-400">
                    Твой дроп
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-white">{winner.name}</h3>
                  <p className={`mt-1 text-sm font-semibold ${winner.color}`}>{winner.rarity}</p>
                  <p className="mt-1 text-sm text-gray-400">{getSellPrice(winner)} Z Coin</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleResultAction("inventory")}
                    disabled={resultClosing}
                    className="rounded-2xl border border-yellow-400/40 bg-yellow-400 px-6 py-3 text-sm font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resultAction === "inventory" ? "Добавляем..." : "Добавить в инвентарь"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResultAction("sell")}
                    disabled={resultClosing}
                    className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resultAction === "sell" ? "Продаём..." : `Продать за ${getSellPrice(winner)} Z Coin`}
                  </button>
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleOpenAgain}
                    disabled={resultClosing}
                    className="w-full max-w-[260px] rounded-2xl border border-yellow-400/30 bg-zinc-900 px-6 py-3 text-sm font-bold text-yellow-300 transition hover:border-yellow-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resultAction === "open-again" ? "Подготавливаем..." : "Открыть ещё"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="mt-12 rounded-[28px] border border-white/8 bg-[#0b1017]/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-yellow-400">Содержимое кейса</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">Возможные дропы</h2>
            <p className="mt-2 text-sm text-slate-400">Нажми на картинку оружия, чтобы посмотреть шанс выпадения</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {caseSkins.map((item) => {
              const isExpanded = item.id === expandedChanceCardId;
              const dropInfo = item.chance;

              return (
                <div
                  key={item.id}
                  className={[
                    "rounded-[22px] border p-4 transition duration-300",
                    isExpanded
                      ? "border-yellow-400/45 bg-yellow-400/10 shadow-[0_0_28px_rgba(250,204,21,0.12)]"
                      : "border-white/8 bg-[#0d131b] hover:border-white/15",
                  ].join(" ")}
                >
                  <div className="relative h-32 overflow-hidden rounded-[18px] border border-white/10 bg-[#0a0f15]">
                    <Image 
                      src={item.image} 
                      alt={item.name} 
                      fill 
                      className="object-contain cursor-pointer transition duration-200 hover:scale-105"
                      sizes="140px"
                      unoptimized
                      onClick={() => setExpandedChanceCardId(isExpanded ? null : item.id)}
                    />
                  </div>

                  {!isExpanded && (
                    <div className="mt-3">
                      <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${item.color}`}>{item.rarity}</p>
                      <h3 className="mt-1 text-sm font-black text-white">{item.name}</h3>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${item.color}`}>{item.rarity}</p>
                        <h3 className="mt-1 text-lg font-black text-white">{item.name}</h3>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">Шанс выпадения</span>
                          <span className="font-black text-white">{dropInfo}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                          <div 
                            className="h-full bg-gradient-to-r from-slate-300 to-white rounded-full"
                            style={{ width: `${dropInfo}%` }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedChanceCardId(null)}
                        className="mt-3 w-full text-xs font-semibold text-yellow-300 hover:text-yellow-200 transition"
                      >
                        Скрыть
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

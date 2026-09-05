"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";
import HelpTip from "@/app/components/HelpTip";
import { getRarityTextClass } from "@/lib/rarity-styles";
import BestDrop from "./components/BestDrop";
import CaseDropList from "./components/CaseDropList";
import CaseRoulette from "./components/CaseRoulette";
import WinnerModal from "./components/WinnerModal";
import MultiWinnerModal from "./components/MultiWinnerModal";
import { buildRouletteSlots, scoreDrop } from "./lib/roulette";
import type { CaseItem, CatalogCase, CatalogDrop, RouletteAnimationRequest } from "./lib/types";

const RECENT_DROPS_KEY = "zeon_recent_drops_v1";
const BEST_DROP_KEY = "zeon_best_drop_v1";
const STORE_UPDATE_EVENT = "zeon-store-updated";
const readRecentDrops = (): CaseItem[] => { try { const raw = localStorage.getItem(RECENT_DROPS_KEY); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed.filter(item => item?.name !== "AK-47 Skin" && item?.name !== "Knife Skin" && item?.image !== "/skins/default.png") : []; } catch { return []; } };
const writeRecentDrops = (items: CaseItem[]) => { const fresh = items.filter(item => !item.timestamp || Date.now() - item.timestamp < 604800000).slice(0, 50); localStorage.setItem(RECENT_DROPS_KEY, JSON.stringify(fresh)); window.dispatchEvent(new Event(STORE_UPDATE_EVENT)); };
const readBestDrop = (): CaseItem | null => { try { const raw = localStorage.getItem(BEST_DROP_KEY); const item = raw ? JSON.parse(raw) : null; return item?.name === "AK-47 Skin" || item?.name === "Knife Skin" || item?.image === "/skins/default.png" ? null : item; } catch { return null; } };
const writeBestDrop = (item: CaseItem | null) => { if (item) localStorage.setItem(BEST_DROP_KEY, JSON.stringify(item)); else localStorage.removeItem(BEST_DROP_KEY); window.dispatchEvent(new Event(STORE_UPDATE_EVENT)); };

export default function CasePage() {
  const [catalog, setCatalog] = useState<CatalogCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [winner, setWinner] = useState<CaseItem | null>(null);
  const [winners, setWinners] = useState<CaseItem[]>([]);
  const [openError, setOpenError] = useState("");
  const [resultVisible, setResultVisible] = useState(false);
  const [resultClosing, setResultClosing] = useState(false);
  const [resultAction, setResultAction] = useState<"inventory" | "sell" | null>(null);
  const [rouletteSlots, setRouletteSlots] = useState<CaseItem[][]>([]);
  const [winnerIndices, setWinnerIndices] = useState<(number | null)[]>([]);
  const [revealWinners, setRevealWinners] = useState<boolean[]>([]);
  const [bestDrop, setBestDrop] = useState<CaseItem | null>(null);
  const [expandedChanceCardId, setExpandedChanceCardId] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [animationRequests, setAnimationRequests] = useState<(RouletteAnimationRequest | null)[]>([]);
  const [resetToken, setResetToken] = useState(0);
  const [freeOpenAvailable, setFreeOpenAvailable] = useState(false);
  const [openQuantity, setOpenQuantity] = useState<1 | 2 | 3>(1);
  const catalogRef = useRef<CatalogCase[]>([]);
  const animationRequestsRef = useRef<(RouletteAnimationRequest | null)[]>([]);
  const rouletteSlotsRef = useRef<CaseItem[][]>([]);
  const winnersRef = useRef<(CaseItem | null)[]>([]);
  const activeCase = catalog.find(item => item.slug === selectedCaseId || item.id === selectedCaseId) ?? null;
  const caseSkins: CaseItem[] = activeCase?.drops.map(drop => ({ id: drop.id, name: drop.name, rarity: drop.rarity, color: getRarityTextClass(drop.rarity), image: drop.image, price: drop.price, chance: drop.probability, caseId: activeCase.slug, caseImage: activeCase.image })) ?? [];
  const totalPrice = (activeCase?.price ?? 0) * openQuantity;

  useEffect(() => { animationRequestsRef.current = animationRequests; }, [animationRequests]);
  useEffect(() => { rouletteSlotsRef.current = rouletteSlots; }, [rouletteSlots]);
  useEffect(() => { winnersRef.current = winners.map(item => item ?? null); }, [winners]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("caseId");
    setSelectedCaseId(requested);
    void fetch(`/api/cases?version=${Date.now()}`, { cache: "no-store", credentials: "include" }).then(async response => {
      if (!response.ok) throw new Error("Не удалось загрузить каталог кейсов");
      return response.json();
    }).then((data: { cases?: CatalogCase[] }) => {
      const next = Array.isArray(data.cases) ? data.cases : [];
      catalogRef.current = next;
      setCatalog(next);
      if (!requested) setSelectedCaseId(next[0]?.slug ?? null);
    }).catch((error: unknown) => setOpenError(error instanceof Error ? error.message : "Не удалось загрузить каталог кейсов"));
  }, []);

  useEffect(() => {
    const sync = () => setBestDrop(readBestDrop());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(STORE_UPDATE_EVENT, sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(STORE_UPDATE_EVENT, sync); };
  }, []);

  useEffect(() => {
    if (!activeCase) { setFreeOpenAvailable(false); return; }
    let cancelled = false;
    void fetch("/api/cases/open", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ caseId: activeCase.id, preview: true, quantity: openQuantity }) })
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => { if (!cancelled) setFreeOpenAvailable(openQuantity === 1 && ok && Boolean(data?.freeOpenAvailable)); })
      .catch(() => { if (!cancelled) setFreeOpenAvailable(false); });
    return () => { cancelled = true; };
  }, [activeCase?.id, openQuantity]);

  useEffect(() => {
    if (!activeCase || !caseSkins.length || rouletteSlots.length || opening || animating || resultVisible) return;
    const preview = buildRouletteSlots(caseSkins);
    if (!preview.slots.length) return;
    setWinnerIndices(Array(openQuantity).fill(null));
    setRevealWinners(Array(openQuantity).fill(false));
    setRouletteSlots(Array.from({ length: openQuantity }, () => [...preview.slots]));
    setAnimationRequests(Array(openQuantity).fill(null));
    winnersRef.current = Array(openQuantity).fill(null);
  }, [activeCase, caseSkins, rouletteSlots.length, opening, animating, resultVisible, openQuantity]);

  const finishRoll = (rouletteIndex: number, requestId: string) => {
    const currentRequests = animationRequestsRef.current;
    const request = currentRequests[rouletteIndex];
    if (!request || request.id !== requestId) return;
    const slots = rouletteSlotsRef.current[rouletteIndex] ?? [];
    const index = request.winnerIndex;
    if (index === undefined || index === null || !slots[index]) return;

    const rollWinner = slots[index];
    const nextRequests = [...currentRequests];
    nextRequests[rouletteIndex] = null;
    animationRequestsRef.current = nextRequests;
    setAnimationRequests(nextRequests);

    setWinnerIndices(current => { const next = [...current]; next[rouletteIndex] = index; return next; });
    setRevealWinners(current => { const next = [...current]; next[rouletteIndex] = true; return next; });

    const nextWinners = [...winnersRef.current];
    nextWinners[rouletteIndex] = rollWinner;
    winnersRef.current = nextWinners;
    setWinners(nextWinners.filter(Boolean) as CaseItem[]);

    if (!nextWinners.every(Boolean)) return;
    const resolvedWinners = nextWinners as CaseItem[];
    setWinner(resolvedWinners[0] ?? null);
    setWinners(resolvedWinners);
    setResultVisible(true);
    setOpening(false);
    setAnimating(false);
    window.dispatchEvent(new Event("zeon-profile-updated"));
  };

  const startCaseRoll = async () => {
    if (opening || animating || resultVisible) return;
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
    const currentCase = currentCatalog.find(item => item.slug === requested || item.id === requested) ?? currentCatalog[0] ?? null;
    const currentSkins: CaseItem[] = currentCase?.drops.map(drop => ({ id: drop.id, name: drop.name, rarity: drop.rarity, color: getRarityTextClass(drop.rarity), image: drop.image, price: drop.price, chance: drop.probability, caseId: currentCase.slug, caseImage: currentCase.image })) ?? [];
    if (!currentCase || !currentSkins.length) { setOpenError("Кейс ещё загружается. Попробуй через секунду."); return; }
    if (selectedCaseId !== currentCase.slug) setSelectedCaseId(currentCase.slug);

    setOpening(true);
    setOpenError("");
    setResultVisible(false);
    setResultClosing(false);
    setRevealWinners(Array(openQuantity).fill(false));
    setWinnerIndices(Array(openQuantity).fill(null));
    setWinner(null);
    winnersRef.current = Array(openQuantity).fill(null);
    setWinners([]);
    setResultAction(null);
    setAnimating(false);
    animationRequestsRef.current = Array(openQuantity).fill(null);
    setAnimationRequests(Array(openQuantity).fill(null));
    setResetToken(value => value + 1);

    try {
      const response = await fetch("/api/cases/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ caseId: currentCase.id, quantity: openQuantity, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await response.json().catch(() => null);
      const serverDrops = Array.isArray(data?.drops) ? data.drops : data?.drop ? [data.drop] : [];
      const serverItems = Array.isArray(data?.items) ? data.items : data?.item ? [data.item] : [];
      if (!response.ok || serverDrops.length !== openQuantity || serverItems.length !== openQuantity) throw new Error(data?.error || "Не удалось открыть кейс");

      setFreeOpenAvailable(false);
      const nextRouletteSlots: CaseItem[][] = [];
      const nextRequests: (RouletteAnimationRequest | null)[] = [];
      const nextIndices: (number | null)[] = [];
      const immediateWinners: (CaseItem | null)[] = [];
      for (let index = 0; index < openQuantity; index += 1) {
        const serverDrop = serverDrops[index] as CatalogDrop;
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
          inventoryItemId: serverItems[index]?.id,
        };
        let track;
        try { track = buildRouletteSlots(currentSkins, rollWinner); } catch { track = { slots: [], winnerSlotIndex: -1 }; }
        if (!track.slots.length || track.winnerSlotIndex < 0) {
          nextRouletteSlots.push([rollWinner]);
          nextIndices.push(0);
          nextRequests.push(null);
          immediateWinners.push(rollWinner);
          continue;
        }
        nextRouletteSlots.push(track.slots);
        nextIndices.push(track.winnerSlotIndex);
        nextRequests.push({ id: crypto.randomUUID(), winnerIndex: track.winnerSlotIndex });
        immediateWinners.push(null);
      }

      rouletteSlotsRef.current = nextRouletteSlots;
      animationRequestsRef.current = nextRequests;
      winnersRef.current = immediateWinners;
      setWinnerIndices(nextIndices);
      setRouletteSlots(nextRouletteSlots);
      setAnimationRequests(nextRequests);
      if (immediateWinners.some(Boolean)) setWinners(immediateWinners.filter(Boolean) as CaseItem[]);

      if (immediateWinners.every(Boolean)) {
        const resolved = immediateWinners as CaseItem[];
        setWinners(resolved);
        setWinner(resolved[0] ?? null);
        setRevealWinners(Array(openQuantity).fill(true));
        setResultVisible(true);
        setOpening(false);
        setAnimating(false);
        window.dispatchEvent(new Event("zeon-profile-updated"));
      }
    } catch (error) {
      setOpening(false);
      setAnimating(false);
      animationRequestsRef.current = [];
      setAnimationRequests([]);
      setOpenError(error instanceof Error ? error.message : "Не удалось открыть кейс");
    }
  };

  const closeResult = () => {
    setResultClosing(true);
    window.setTimeout(() => {
      setResultVisible(false);
      setResultClosing(false);
      setWinner(null);
      setWinners([]);
      winnersRef.current = [];
      setRevealWinners([]);
      setWinnerIndices([]);
      setResultAction(null);
      animationRequestsRef.current = [];
      setAnimationRequests([]);
      setResetToken(value => value + 1);
      setRouletteSlots([]);
    }, 250);
  };

  const handleResultAction = async (action: "inventory" | "sell") => {
    if (!winner) return;
    setResultAction(action);
    if (action === "sell") {
      try {
        const response = await fetch("/api/inventory/sell", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ inventoryItemId: winner.inventoryItemId }) });
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
    setWinners([]);
    winnersRef.current = [];
    setRevealWinners([]);
    setWinnerIndices([]);
    setResultAction(null);
    animationRequestsRef.current = [];
    setAnimationRequests([]);
    setResetToken(value => value + 1);
    requestAnimationFrame(() => void startCaseRoll());
  };

  useEffect(() => {
    if (!winners.length || !resultVisible) return;
    writeRecentDrops([...winners.map(item => ({ ...item, timestamp: Date.now() })), ...readRecentDrops()]);
    const current = readBestDrop();
    const best = winners.reduce((bestItem, item) => !bestItem || scoreDrop(item) >= scoreDrop(bestItem) ? item : bestItem, current);
    writeBestDrop(best);
  }, [winners, resultVisible]);

  const activeCaseName = activeCase?.name ?? "Загрузка кейса...";
  return <main className="relative min-h-screen overflow-hidden bg-[#05070b] px-4 py-6 text-white sm:px-6 sm:py-10"><div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute left-1/2 top-16 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-purple-700/10 blur-[130px]" /></div><div className="relative mx-auto max-w-6xl"><div className="mb-6 flex items-center justify-between gap-4 sm:mb-10"><Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-gray-200">← Назад</Link></div><div className="text-center"><div className="flex items-center justify-center gap-2"><p className="text-[11px] font-black uppercase tracking-[0.42em] text-yellow-300">ZEONGGSTORE</p><HelpTip text="Здесь находится выбранный кейс. Внутри указаны доступные предметы, их редкость, стоимость и шанс выпадения." label="Что такое кейс?" /></div><h1 className="mt-3 break-words text-3xl font-black tracking-tight sm:text-5xl">{activeCaseName}</h1><div className="mx-auto mt-3 flex max-w-2xl items-center justify-center gap-2 text-sm leading-6 text-slate-400 sm:text-base"><span>Открой кейс, прокрути рулетку и получи один или несколько предметов.</span><HelpTip text="Количество открытий выбирается под рулетками. При 2× или 3× стоимость кейса умножается на выбранное количество кейсов." label="Как работает мульти-открытие?" /></div></div><div className="mt-8 sm:mt-10"><RecentDropsStrip title="Последние дропы" /></div><BestDrop bestDrop={bestDrop} /><section className="mt-8 sm:mt-10"><div className="rounded-[28px] border border-purple-300/10 bg-[radial-gradient(circle_at_center,rgba(109,40,217,0.16),rgba(7,9,14,0.96)_62%)] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.45)] sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Кейс</p><HelpTip text="Изображение кейса здесь больше не используется — основной акцент страницы сделан на рулетке, шансах и самом открытии." label="Зачем убрана картинка кейса?" /></div><p className="mt-2 text-2xl font-black text-white sm:text-3xl">{activeCaseName}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-right"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Предметов</p><p className="mt-1 text-xl font-black text-white">{caseSkins.length}</p></div></div></div></section><section className="mt-8 sm:mt-10"><div className="mb-3 flex items-center justify-between gap-4 px-1"><div className="flex items-center gap-2"><p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Рулетка{openQuantity > 1 ? ` ×${openQuantity}` : ""}</p><HelpTip text="При мульти-открытии рулетки располагаются вертикально. Каждая рулетка показывает отдельный серверный результат." label="Как работают рулетки?" /></div><span className="hidden text-xs font-semibold text-slate-500 sm:block">Указатель всегда стоит по центру</span></div><div className="space-y-3">{rouletteSlots.map((slots, index) => <div key={index} className={openQuantity > 1 ? "origin-top scale-[0.92] -mb-2" : ""}><CaseRoulette slots={slots} winnerIndex={winnerIndices[index] ?? null} revealWinner={revealWinners[index] ?? false} request={animationRequests[index] ?? null} resetToken={resetToken} onAnimatingChange={() => undefined} onFinished={(requestId) => finishRoll(index, requestId)} /></div>)}</div></section>{!resultVisible && <section className="mt-6 text-center sm:mt-8"><div className="mb-4 flex items-center justify-center gap-2"><button type="button" onClick={() => !opening && !animating && setOpenQuantity(1)} disabled={opening || animating} className={["rounded-xl border px-4 py-2 text-sm font-black transition-all", openQuantity === 1 ? "border-yellow-300/70 bg-yellow-400/15 text-yellow-200 shadow-[0_0_22px_rgba(250,204,21,0.18)]" : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20"].join(" ")}>1×</button><button type="button" onClick={() => !opening && !animating && setOpenQuantity(2)} disabled={opening || animating} className={["rounded-xl border px-4 py-2 text-sm font-black transition-all", openQuantity === 2 ? "border-yellow-300/70 bg-yellow-400/15 text-yellow-200 shadow-[0_0_22px_rgba(250,204,21,0.18)]" : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20"].join(" ")}>2×</button><button type="button" onClick={() => !opening && !animating && setOpenQuantity(3)} disabled={opening || animating} className={["rounded-xl border px-4 py-2 text-sm font-black transition-all", openQuantity === 3 ? "border-yellow-300/70 bg-yellow-400/15 text-yellow-200 shadow-[0_0_22px_rgba(250,204,21,0.18)]" : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20"].join(" ")}>3×</button></div>{openError && <p className="mx-auto mt-4 max-w-xl text-sm font-semibold text-red-300">{openError}</p>}{freeOpenAvailable && <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-emerald-300"><span>Промокод активен: этот кейс можно открыть бесплатно.</span><HelpTip text="Бесплатное открытие доступно только для 1×. При 2× и 3× оплачивается полная стоимость выбранного количества кейсов." label="Что значит бесплатно?" /></div>}<div className="mt-5 flex flex-col items-center justify-center gap-2"><button type="button" onClick={() => void startCaseRoll()} disabled={opening || animating} className="group relative min-w-[250px] overflow-hidden rounded-2xl bg-gradient-to-b from-yellow-200 to-amber-400 px-10 py-5 text-lg font-black text-[#17120a] shadow-[0_0_36px_rgba(250,204,21,0.22)] disabled:cursor-wait disabled:opacity-70"><span className="relative">{opening || animating ? "Открываем..." : freeOpenAvailable ? "Открыть бесплатно" : `Открыть ${openQuantity}× за ${totalPrice} Z Coin`}</span></button><HelpTip text="Сумма автоматически умножается на выбранное количество открытий. Сервер проверяет и списывает именно эту сумму." label="Что делает кнопка открытия?" /></div></section>}{resultVisible && winners.length === 1 && winner && <WinnerModal winner={winner} resultClosing={resultClosing} resultAction={resultAction} onAction={handleResultAction} onOpenAgain={handleOpenAgain} />}{resultVisible && winners.length > 1 && <MultiWinnerModal winners={winners} resultClosing={resultClosing} onClose={closeResult} onOpenAgain={handleOpenAgain} />}<section className="mt-10"><CaseDropList drops={caseSkins} expandedId={expandedChanceCardId} onToggle={setExpandedChanceCardId} /></section></div></main>;
}

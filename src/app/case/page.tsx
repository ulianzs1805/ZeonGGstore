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
    return Array.isArray(parsed)
      ? parsed.filter((item) => item?.name !== "AK-47 Skin" && item?.name !== "Knife Skin" && item?.image !== "/skins/default.png")
      : [];
  } catch {
    return [];
  }
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
  } catch {
    return null;
  }
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

  const uniqueDrops = activeCase?.drops.filter((item, index, all) =>
    all.findIndex((candidate) => candidate.id === item.id || (candidate.name === item.name && candidate.image === item.image)) === index,
  ) ?? [];
  const rarestChance = uniqueDrops.length ? Math.min(...uniqueDrops.map((item) => Number(item.probability) || 0).filter((value) => value > 0)) : null;

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
    const sync = () => setBestDrop(readBestDrop());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(STORE_UPDATE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(STORE_UPDATE_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!activeCase || !caseSkins.length || rouletteSlots.length || opening || animating || resultVisible) return;
    const preview = buildRouletteSlots(caseSkins);
    if (!preview.slots.length) return;
    setWinnerIndex(null);
    setRevealWinner(false);
    setRouletteSlots(preview.slots);
  }, [activeCase, caseSkins, rouletteSlots.length, opening, animating, resultVisible]);

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
      id: drop.id,
      name: drop.name,
      rarity: drop.rarity,
      color: getRarityTextClass(drop.rarity),
      image: drop.image,
      price: drop.price,
      chance: drop.probability,
      caseId: currentCase.slug,
      caseImage: currentCase.image,
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
    setRouletteSlots([]);
    setResetToken((value) => value + 1);

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

      const track = buildRouletteSlots(currentSkins, rollWinner);
      if (!track.slots.length) throw new Error("Не удалось подготовить рулетку");
      setWinnerIndex(track.winnerSlotIndex);
      setRouletteSlots(track.slots);
      setAnimationRequest({ id: crypto.randomUUID(), winnerIndex: track.winnerSlotIndex });
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
      setRouletteSlots([]);
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
    <main className="relative min-h-screen overflow-hidden bg-[#05070b] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-16 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-purple-700/10 blur-[130px]" />
        <div className="absolute left-[-160px] top-[520px] h-[420px] w-[420px] rounded-full bg-fuchsia-600/5 blur-[120px]" />
        <div className="absolute right-[-120px] top-[760px] h-[420px] w-[420px] rounded-full bg-amber-300/5 blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4 sm:mb-10">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-gray-200 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.07] active:scale-95">← Назад</Link>
          <div className="hidden rounded-full border border-yellow-300/15 bg-yellow-300/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-yellow-200 sm:block">Zeon Case Opening</div>
        </div>

        <div className="text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.42em] text-yellow-300">ZEONGGSTORE</p>
          <h1 className="mt-3 break-words text-3xl font-black tracking-tight sm:text-5xl">{activeCaseName}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">Открой кейс, прокрути рулетку и получи один из предметов, которые уже добавлены именно в этот кейс.</p>
        </div>

        <div className="mt-8 sm:mt-10"><RecentDropsStrip title="Последние дропы" /></div>
        <BestDrop bestDrop={bestDrop} />

        <section className="mt-10 grid items-center gap-5 xl:grid-cols-[220px_minmax(0,1fr)_220px]">
          <aside className="rounded-[26px] border border-white/10 bg-[#0b1018]/85 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-purple-300">О кейсе</p>
            <h2 className="mt-4 text-xl font-black text-white">{activeCaseName}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">В рулетке используются только предметы из текущего кейса. Состав не подменяется во время прокрутки.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Дропов</p>
                <p className="mt-1 text-xl font-black text-white">{uniqueDrops.length}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Редкий шанс</p>
                <p className="mt-1 text-lg font-black text-yellow-200">{rarestChance === null ? "—" : `${rarestChance}%`}</p>
              </div>
            </div>
          </aside>

          <div className="relative min-h-[360px] overflow-hidden rounded-[34px] border border-purple-300/10 bg-[radial-gradient(circle_at_center,rgba(109,40,217,0.22),rgba(7,9,14,0.96)_58%)] px-4 py-8 shadow-[0_30px_100px_rgba(0,0,0,0.5)] sm:min-h-[470px] sm:px-10">
            <div className="pointer-events-none absolute inset-x-8 bottom-6 top-10 rounded-[36px] border border-purple-300/[0.06]" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/20 blur-[70px]" />
            {activeCase?.image ? (
              <div className="relative mx-auto flex h-[300px] w-full max-w-[470px] items-center justify-center sm:h-[390px]">
                <div className="absolute inset-8 rounded-full bg-purple-500/10 blur-3xl" />
                <Image src={activeCase.image} alt={activeCaseName} fill className="object-contain drop-shadow-[0_24px_38px_rgba(0,0,0,0.75)]" sizes="(max-width: 640px) 90vw, 470px" unoptimized priority />
              </div>
            ) : (
              <div className="relative flex h-[300px] items-center justify-center sm:h-[390px]"><span className="text-sm text-slate-500">Картинка кейса загружается...</span></div>
            )}
            <div className="relative -mt-2 text-center sm:-mt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.34em] text-purple-200/70">Сейчас открываешь</p>
              <p className="mt-2 text-2xl font-black text-white sm:text-3xl">{activeCaseName}</p>
            </div>
          </div>

          <aside className="rounded-[26px] border border-white/10 bg-[#0b1018]/85 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-yellow-300">Стабильная рулетка</p>
            <p className="mt-4 text-sm leading-6 text-slate-400">Предметы заранее собраны в ленту. После результата сервера лента не перерисовывается и соседние скины не меняются.</p>
            <div className="mt-5 rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.04] p-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300"><span>Указатель</span><span className="text-yellow-200">Центр</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full w-full rounded-full bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-200 opacity-90" /></div>
            </div>
          </aside>
        </section>

        <section className="mt-8 sm:mt-10">
          <div className="mb-3 flex items-center justify-between gap-4 px-1">
            <div><p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Рулетка</p><h2 className="mt-1 text-lg font-black text-white">Возможный результат уже перед тобой</h2></div>
            <span className="hidden text-xs font-semibold text-slate-500 sm:block">Указатель всегда стоит по центру</span>
          </div>
          <CaseRoulette slots={rouletteSlots} winnerIndex={winnerIndex} revealWinner={revealWinner} request={animationRequest} resetToken={resetToken} onAnimatingChange={setAnimating} onFinished={finishRoll} />
        </section>

        {!resultVisible && (
          <section className="mt-6 text-center sm:mt-8">
            <div className="mx-auto inline-flex overflow-hidden rounded-2xl border border-white/10 bg-[#0c1119] p-1 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
              <button type="button" className="rounded-xl bg-white/10 px-5 py-2 text-sm font-black text-white">×1</button>
              <span className="cursor-not-allowed px-4 py-2 text-sm font-bold text-slate-600">×2</span>
              <span className="cursor-not-allowed px-4 py-2 text-sm font-bold text-slate-600">×3</span>
              <span className="hidden cursor-not-allowed px-4 py-2 text-sm font-bold text-slate-600 sm:inline">×5</span>
              <span className="hidden cursor-not-allowed px-4 py-2 text-sm font-bold text-slate-600 sm:inline">×10</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-600">Мультиоткрытие пока не меняет игровую механику</p>
            {openError && <p className="mx-auto mt-4 max-w-xl text-sm font-semibold text-red-300">{openError}</p>}
            <button type="button" onClick={() => void startCaseRoll()} disabled={opening || animating} aria-busy={opening || animating} className="group relative mt-5 min-w-[250px] overflow-hidden rounded-2xl bg-gradient-to-b from-yellow-200 to-amber-400 px-10 py-5 text-lg font-black text-[#17120a] shadow-[0_0_36px_rgba(250,204,21,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_55px_rgba(250,204,21,0.36)] active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70">
              {(opening || animating) && <span className="absolute inset-y-0 left-[-40%] w-2/5 -skew-x-12 bg-white/35 blur-md animate-[shimmer_900ms_linear_infinite]" />}
              <span className="relative">{opening || animating ? "Открываем..." : "Открыть кейс"}</span>
            </button>
          </section>
        )}

        {winner && resultVisible && <WinnerModal winner={winner} resultClosing={resultClosing} resultAction={resultAction} onAction={handleResultAction} onOpenAgain={handleOpenAgain} />}

        <CaseDropList activeCase={activeCase} expandedChanceCardId={expandedChanceCardId} onToggle={(id) => setExpandedChanceCardId((current) => current === id ? null : id)} />
      </div>
    </main>
  );
}

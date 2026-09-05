"use client";

import Image from "next/image";
import { useState } from "react";
import { resolveSkinImage } from "@/lib/skin-image";
import type { CaseItem } from "../lib/types";

type Props = {
  winners: CaseItem[];
  resultClosing: boolean;
  onClose: () => void;
  onOpenAgain: () => void;
};

export default function MultiWinnerModal({ winners, resultClosing, onClose, onOpenAgain }: Props) {
  const [selling, setSelling] = useState(false);
  const [sellError, setSellError] = useState("");

  const handleSellAll = async () => {
    if (selling || !winners.length) return;
    setSelling(true);
    setSellError("");
    try {
      for (const winner of winners) {
        if (!winner.inventoryItemId) continue;
        const response = await fetch("/api/inventory/sell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ inventoryItemId: winner.inventoryItemId }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Не удалось продать предмет");
      }
      window.dispatchEvent(new Event("zeon-profile-updated"));
      onClose();
    } catch (error) {
      setSellError(error instanceof Error ? error.message : "Не удалось продать предмет");
      setSelling(false);
    }
  };

  return (
    <div className={["mt-8 rounded-3xl border border-yellow-400/20 bg-zinc-950/90 p-5 transition-all sm:p-6", resultClosing ? "opacity-0" : "opacity-100"].join(" ")}>
      <div className="mb-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-400">Твои дропы</p>
        <h3 className="mt-2 text-2xl font-black sm:text-3xl">Открыто ×{winners.length}</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {winners.map((winner, index) => {
          const imageSrc = resolveSkinImage(winner.name, winner.image);
          return (
            <div key={`${winner.inventoryItemId ?? winner.id}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
              <div className="relative mx-auto h-28 w-28">
                <Image src={imageSrc} alt={winner.name} fill className="object-contain" sizes="112px" unoptimized priority={index < 3} />
              </div>
              <p className="mt-3 break-words text-base font-black text-white">{winner.name}</p>
              <p className={`mt-1 text-sm font-semibold ${winner.color}`}>{winner.rarity}</p>
              <p className="mt-1 text-sm text-gray-400">{winner.price} Z Coin</p>
            </div>
          );
        })}
      </div>

      {sellError ? <p className="mt-4 text-center text-sm font-semibold text-red-400">{sellError}</p> : null}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" onClick={onClose} disabled={resultClosing || selling} className="rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-black transition-transform duration-200 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
          Добавить в инвентарь
        </button>
        <button type="button" onClick={handleSellAll} disabled={resultClosing || selling} className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-3 text-sm font-bold text-red-300 transition-all hover:border-red-300/60 hover:bg-red-400/15 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
          {selling ? "Продажа..." : `Продать всё · ${winners.reduce((sum, item) => sum + item.price, 0)} Z Coin`}
        </button>
        <button type="button" onClick={onOpenAgain} disabled={resultClosing || selling} className="rounded-2xl border border-yellow-400/30 bg-zinc-900 px-5 py-3 text-sm font-bold text-yellow-300 transition-all duration-200 hover:border-yellow-300/60 hover:bg-yellow-400/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
          Открыть ещё ×{winners.length}
        </button>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import type { CaseItem } from "../lib/types";

type Props = { winner: CaseItem; resultClosing: boolean; resultAction: "inventory" | "sell" | null; onAction: (action: "inventory" | "sell") => void; onOpenAgain: () => void };

export default function WinnerModal({ winner, resultClosing, resultAction, onAction, onOpenAgain }: Props) {
  return (
    <div className={["mt-8 rounded-3xl border border-yellow-400/20 bg-zinc-950/90 p-6 transition-all", resultClosing ? "opacity-0" : "opacity-100"].join(" ")}>
      <div className="flex flex-col gap-6">
        <div className="flex min-w-0 items-center gap-5">
          <div className="relative h-24 w-24 shrink-0">
            <Image src={winner.image} alt={winner.name} fill className="object-contain" sizes="96px" unoptimized priority />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-yellow-400">Твой дроп</p>
            <h3 className="mt-2 break-words text-2xl font-black">{winner.name}</h3>
            <p className={`mt-1 text-sm font-semibold ${winner.color}`}>{winner.rarity}</p>
            <p className="mt-1 text-sm text-gray-400">{winner.price} Z Coin</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => onAction("inventory")} disabled={resultClosing} className="rounded-2xl bg-yellow-400 px-6 py-3 text-sm font-black text-black transition-transform duration-200 hover:scale-[1.02] active:scale-95">{resultAction === "inventory" ? "Сохраняем..." : "Оставить в инвентаре"}</button>
          <button type="button" onClick={() => onAction("sell")} disabled={resultClosing} className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-95">{resultAction === "sell" ? "Продаём..." : `Продать за ${winner.price} Z Coin`}</button>
        </div>
        <button type="button" onClick={onOpenAgain} disabled={resultClosing} className="rounded-2xl border border-yellow-400/30 bg-zinc-900 px-6 py-3 text-sm font-bold text-yellow-300 transition-all duration-200 hover:border-yellow-300/60 hover:bg-yellow-400/10 active:scale-95">Открыть ещё</button>
      </div>
    </div>
  );
}

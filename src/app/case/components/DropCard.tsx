"use client";

import { useMemo } from "react";
import { getRarityCardClass } from "@/lib/rarity-styles";
import { resolveSkinImage } from "@/lib/skin-image";
import type { CaseItem } from "../lib/types";

export default function DropCard({ item, winner = false }: { item: CaseItem; winner?: boolean }) {
  const imageSrc = useMemo(
    () => resolveSkinImage(item.name, typeof item.image === "string" ? item.image : ""),
    [item.name, item.image],
  );

  return (
    <div
      className={[
        "relative flex min-w-[180px] flex-col items-center rounded-[22px] border-2 p-4 backdrop-blur-sm transition-transform duration-300",
        getRarityCardClass(item.rarity),
        winner
          ? "ring-2 ring-yellow-300/80 shadow-[0_0_45px_rgba(250,204,21,0.55)] scale-[1.04] animate-[pulse_900ms_ease-in-out_2]"
          : "hover:-translate-y-1 hover:scale-[1.02]",
      ].join(" ")}
    >
      {winner && <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-yellow-300/10 blur-xl" />}
      <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[18px]">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={item.name}
            width={112}
            height={112}
            className="h-28 w-28 object-contain"
            loading="eager"
            decoding="async"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-xs font-semibold text-slate-400">
            Изображение недоступно
          </div>
        )}
      </div>
      <h3 className={`mt-3 text-center font-black ${item.color}`}>{item.name}</h3>
      <p className="mt-1 text-[11px] font-medium uppercase text-slate-200/80">{item.rarity}</p>
    </div>
  );
}

"use client";

import Image from "next/image";
import type { CaseItem } from "../lib/types";

type Props = { bestDrop: CaseItem | null };

export default function BestDrop({ bestDrop }: Props) {
  if (!bestDrop) return null;
  return (
    <div className="mt-6 rounded-[26px] border border-yellow-400/40 bg-zinc-950 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-yellow-300/60">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-yellow-300">Лучший дроп</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0"><Image src={bestDrop.image} alt={bestDrop.name} fill className="object-contain" sizes="80px" unoptimized priority /></div>
        <div className="min-w-0"><h3 className="truncate text-2xl font-black">{bestDrop.name}</h3><p className="text-sm text-slate-300">{bestDrop.price} Z Coin · исторический рекорд</p></div>
      </div>
    </div>
  );
}

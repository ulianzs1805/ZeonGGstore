"use client";

import Image from "next/image";
import { getRarityTextClass } from "@/lib/rarity-styles";
import type { CatalogCase } from "../lib/types";

type Props = { activeCase: CatalogCase | null; expandedChanceCardId: string | null; onToggle: (id: string) => void };

export default function CaseDropList({ activeCase, expandedChanceCardId, onToggle }: Props) {
  const drops = activeCase?.drops ?? [];
  return (
    <section className="mt-12 rounded-[28px] border border-white/8 bg-[#0b1017]/80 p-4 sm:p-6">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-yellow-400">Содержимое кейса</p>
        <h2 className="mt-3 text-3xl font-black text-white">Возможные дропы</h2>
        <p className="mt-2 text-sm text-slate-400">Нажми на картинку оружия, чтобы посмотреть шанс выпадения</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {drops.map((item) => {
          const expanded = expandedChanceCardId === item.id;
          const color = getRarityTextClass(item.rarity);
          return (
            <button key={item.id} type="button" onClick={() => onToggle(item.id)} className="group rounded-[22px] border border-white/8 bg-[#0d131b] p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_0_30px_rgba(168,85,247,0.16)] active:scale-[0.98]">
              <div className="relative h-32 overflow-hidden rounded-[18px]"><Image src={item.image} alt={item.name} fill className="object-contain transition-transform duration-500 group-hover:scale-105" sizes="140px" unoptimized /></div>
              <p className={`mt-3 text-[10px] font-semibold uppercase ${color}`}>{item.rarity}</p>
              <h3 className="mt-1 text-sm font-black text-white">{item.name}</h3>
              {expanded && <p className="mt-3 text-sm font-semibold text-yellow-300">Шанс выпадения: {item.probability}%</p>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import { getRarityTextClass } from "@/lib/rarity-styles";
import { StateMessage } from "./AccountShell";
import type { InventoryItem } from "./account-types";

export default function InventorySection({ items, sellingId, onSell }: { items: InventoryItem[]; sellingId: string | null; onSell: (item: InventoryItem) => void }) {
  if (!items.length) return <StateMessage>Инвентарь пока пуст</StateMessage>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="rounded-[18px] border border-white/10 bg-[#0b1017] p-3"><div className="relative h-[150px] overflow-hidden rounded-[14px] border border-white/10 bg-[#080d15]"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="260px" unoptimized /></div><p className={`mt-3 text-[0.62rem] uppercase tracking-[0.18em] ${getRarityTextClass(item.rarity)}`}>{item.rarity}</p><h2 className="mt-2 font-black text-white">{item.name}</h2><div className="mt-3 flex items-center justify-between text-sm text-slate-300"><span>{item.price} Z</span><button type="button" disabled={sellingId === item.id} onClick={() => onSell(item)} className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-xs font-black uppercase text-violet-100 disabled:opacity-50">{sellingId === item.id ? "Продажа..." : "Продать"}</button></div></article>)}</div>;
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { getRarityTextClass } from "@/lib/rarity-styles";
import { StateMessage } from "./AccountShell";
import type { InventoryItem } from "./account-types";

function WithdrawalForm({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [gameId, setGameId] = useState("");
  const [listingSkinName, setListingSkinName] = useState("");
  const [listingPriceGold, setListingPriceGold] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async () => {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/withdrawal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inventoryItemId: item.id, gameId, listingSkinName, listingPriceGold: Number(listingPriceGold) }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Не удалось создать заявку");
      setMessage(`Заявка ${result.id} создана. После проверки модератор обработает вывод.`);
      setTimeout(onClose, 1800);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось создать заявку"); }
    finally { setLoading(false); }
  };
  return <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/[.05] p-4">
    <div className="text-sm font-black text-white">Вывод в Standoff 2</div>
    <p className="mt-1 text-xs leading-5 text-slate-400">Укажи игровой ID и данные предмета, который выставишь на внутриигровом рынке. Заявка уйдёт модератору.</p>
    <div className="mt-3 grid gap-2">
      <input value={gameId} onChange={(e) => setGameId(e.target.value)} placeholder="Игровой ID" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50" />
      <input value={listingSkinName} onChange={(e) => setListingSkinName(e.target.value)} placeholder="Название предмета, который выставите" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50" />
      <input value={listingPriceGold} onChange={(e) => setListingPriceGold(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Цена выставления в Gold" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50" />
    </div>
    {message && <p className="mt-3 text-xs text-violet-200">{message}</p>}
    <div className="mt-3 flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-slate-300">Отмена</button><button type="button" disabled={loading} onClick={() => void submit()} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{loading ? "Создаём..." : "Создать заявку"}</button></div>
  </div>;
}

export default function InventorySection({ items, sellingId, onSell }: { items: InventoryItem[]; sellingId: string | null; onSell: (item: InventoryItem) => void }) {
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  if (!items.length) return <StateMessage>Инвентарь пока пуст</StateMessage>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="rounded-[18px] border border-white/10 bg-[#0b1017] p-3"><div className="relative h-[150px] overflow-hidden rounded-[14px] border border-white/10 bg-[#080d15]"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="260px" unoptimized /></div><p className={`mt-3 text-[0.62rem] uppercase tracking-[0.18em] ${getRarityTextClass(item.rarity)}`}>{item.rarity}</p><h2 className="mt-2 font-black text-white">{item.name}</h2><div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-300"><span>{item.price} Z</span><div className="flex gap-2"><button type="button" disabled={sellingId === item.id} onClick={() => onSell(item)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-black text-slate-300 disabled:opacity-50">{sellingId === item.id ? "Продажа..." : "Продать"}</button><button type="button" onClick={() => setWithdrawId(withdrawId === item.id ? null : item.id)} className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-100">Вывести</button></div></div>{withdrawId === item.id && <WithdrawalForm item={item} onClose={() => setWithdrawId(null)} />}</article>)}</div>;
}

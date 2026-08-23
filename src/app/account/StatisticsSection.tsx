"use client";

import { StateMessage } from "./AccountShell";
import { number } from "./account-types";
import type { InventoryItem, Statistics } from "./account-types";

export default function StatisticsSection({ statistics, bestDrop }: { statistics: Statistics | null; bestDrop: InventoryItem | null }) {
  const cards = [{ label: "Предметов в инвентаре", value: statistics?.inventoryCount ?? "—" }, { label: "Стоимость инвентаря", value: statistics ? `${number(statistics.inventoryValue)} Z` : "—" }, { label: "Открыто кейсов", value: statistics?.openedCases ?? "—" }, { label: "Лучший дроп", value: bestDrop ? `${bestDrop.name} · ${bestDrop.price} Z` : "—" }, { label: "Потрачено Z-Coin", value: statistics ? `${number(statistics.spent)} Z` : "—" }, { label: "Получено Z-Coin", value: statistics ? `${number(statistics.earned)} Z` : "—" }, { label: "Продаж", value: statistics?.soldItems ?? "—" }];
  if (!statistics) return <StateMessage>Статистика загружается...</StateMessage>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((stat) => <div key={stat.label} className="rounded-[18px] border border-white/10 bg-[#0b1017] p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">{stat.label}</p><p className="mt-4 break-words text-xl font-black text-violet-100">{stat.value}</p></div>)}</div>;
}

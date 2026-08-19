"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import SidebarNav, { type SidebarSection } from "./SidebarNav";
import SupportTicketPanel from "./SupportTicketPanel";
import { getRarityTextClass } from "@/lib/rarity-styles";

type InventoryItem = { id: string; name: string; rarity: string; image: string; price: number; addedAt: string };
type Operation = { id: string; type: string; label: string | null; amount: number; status: string; createdAt: string; item?: { name: string } | null };
type Transaction = { id: string; type: string; rubAmount: number | null; zCoinAmount: number; status: string; paymentId: string | null; createdAt: string };
type Ticket = { id: string; subject: string; description: string; status: string; createdAt: string };
type ProfileData = {
  user: { name: string | null; email: string; createdAt: string; role: "USER" | "ADMIN" | "DEV" | "NPN1_DEV" };
  inventory: InventoryItem[];
  operations: Operation[];
  transactions: Transaction[];
  tickets: Ticket[];
};
type Statistics = { inventoryCount: number; inventoryValue: number; openedCases: number; soldItems: number; spent: number; earned: number };

type Section = Exclude<SidebarSection, "profile">;

function number(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function date(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function Shell({ active, title, children }: { active: Section; title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#04070d] text-white">
      <div className="mx-auto max-w-[1460px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[26px] border border-violet-500/10 bg-[#060b13] shadow-[0_0_50px_rgba(153,92,255,0.14)]">
          <div className="flex min-h-[620px] flex-col bg-[#060b13] lg:flex-row">
            <aside className="w-full border-b border-white/10 bg-[#060b13] p-5 lg:w-[260px] lg:border-b-0 lg:border-r">
              <div className="mb-6 flex items-center gap-2"><span className="text-[1.7rem] font-black tracking-[-0.12em] text-[#f6f1ff]">ZEON</span><span className="text-[0.52rem] font-black tracking-[0.42em] text-violet-300/90">GGSTORE</span></div>
              <SidebarNav active={active} />
            </aside>
            <section className="flex-1 bg-[#070d16]">
              <div className="border-b border-white/10 bg-[#070d16]/70 px-5 py-5 sm:px-6 lg:px-7"><h1 className="text-2xl font-black tracking-[-0.06em] text-white">{title}</h1></div>
              <div className="p-5 sm:p-6 lg:p-7">{children}</div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function StateMessage({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[18px] border border-dashed border-white/10 bg-[#0d131b]/70 p-6 text-center text-sm text-slate-300">{children}</div>;
}

export default function AccountSection({ section }: { section: Section }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState("");
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);

  const load = async () => {
    const response = await fetch("/api/profile", { cache: "no-store" });
    if (!response.ok) {
      setError("Не удалось загрузить данные аккаунта");
      return;
    }
    setData(await response.json());
  };

  const loadStatistics = async () => {
    const response = await fetch("/api/statistics", { cache: "no-store" });
    if (response.ok) setStatistics(await response.json());
  };

  useEffect(() => { void Promise.all([load(), loadStatistics()]); }, []);

  const sell = async (item: InventoryItem) => {
    if (!window.confirm(`Продать предмет «${item.name}» за ${item.price} Z-Coin?`)) return;
    setSellingId(item.id);
    setError("");
    const response = await fetch("/api/inventory/sell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inventoryItemId: item.id }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) setError(result?.error || "Не удалось продать предмет");
    else {
      await load();
      await loadStatistics();
      window.dispatchEvent(new Event("zeon-profile-updated"));
    }
    setSellingId(null);
  };

  const resetBetaAccess = async () => {
    await fetch("/api/beta", { method: "DELETE" });
    window.location.href = "/beta";
  };

  if (error && !data) return <Shell active={section} title="Аккаунт"><StateMessage>{error}</StateMessage></Shell>;
  if (!data) return <Shell active={section} title="Аккаунт"><StateMessage>Загружаем данные...</StateMessage></Shell>;

  const sales = data.operations.filter((operation) => operation.type === "ITEM_SALE");
  const deposits = data.transactions.filter((transaction) => transaction.type === "DEPOSIT" || transaction.type === "PURCHASE").reduce((sum, transaction) => sum + transaction.zCoinAmount, 0);
  const received = deposits + sales.reduce((sum, operation) => sum + operation.amount, 0);
  const bestDrop = data.inventory.reduce<InventoryItem | null>((best, item) => !best || item.price > best.price ? item : best, null);
  const title = section === "inventory" ? "Инвентарь" : section === "transactions" ? "История транзакций" : section === "statistics" ? "Статистика" : section === "settings" ? "Настройки" : "Поддержка";

  return (
    <Shell active={section} title={title}>
      {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {section === "inventory" && (
        data.inventory.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.inventory.map((item) => <article key={item.id} className="rounded-[18px] border border-white/10 bg-[#0b1017] p-3"><div className="relative h-[150px] overflow-hidden rounded-[14px] border border-white/10 bg-[#080d15]"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="260px" unoptimized /></div><p className={`mt-3 text-[0.62rem] uppercase tracking-[0.18em] ${getRarityTextClass(item.rarity)}`}>{item.rarity}</p><h2 className="mt-2 font-black text-white">{item.name}</h2><div className="mt-3 flex items-center justify-between text-sm text-slate-300"><span>{item.price} Z</span><button type="button" disabled={sellingId === item.id} onClick={() => void sell(item)} className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-xs font-black uppercase text-violet-100 disabled:opacity-50">{sellingId === item.id ? "Продажа..." : "Продать"}</button></div></article>)}</div> : <StateMessage>Инвентарь пока пуст</StateMessage>
      )}
      {section === "transactions" && (data.transactions.length ? <div className="space-y-3">{data.transactions.map((transaction) => <div key={transaction.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b1017] p-4 text-sm"><div><p className="font-semibold text-white">{transaction.type === "DEPOSIT" ? "Пополнение баланса" : transaction.type === "PURCHASE" ? "Покупка Z-Coin" : transaction.type === "REFUND" ? "Возврат средств" : transaction.type === "FAILED" ? "Неуспешная транзакция" : transaction.type === "SALE" ? "Продажа предмета" : transaction.type}</p><p className="mt-1 text-slate-400">{date(transaction.createdAt)} · {transaction.status} · ID: {transaction.id}</p>{transaction.rubAmount !== null && <p className="mt-1 text-slate-500">{number(transaction.rubAmount)} ₽</p>}</div><span className="font-bold text-violet-100">{transaction.zCoinAmount > 0 ? "+" : ""}{number(transaction.zCoinAmount)} Z</span></div>)}</div> : <StateMessage>Транзакций пока нет</StateMessage>)}
      {section === "statistics" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[{ label: "Предметов в инвентаре", value: statistics?.inventoryCount ?? "—" }, { label: "Стоимость инвентаря", value: statistics ? `${number(statistics.inventoryValue)} Z` : "—" }, { label: "Открыто кейсов", value: statistics?.openedCases ?? "—" }, { label: "Лучший дроп", value: bestDrop ? `${bestDrop.name} · ${bestDrop.price} Z` : "—" }, { label: "Потрачено Z-Coin", value: statistics ? `${number(statistics.spent)} Z` : "—" }, { label: "Получено Z-Coin", value: statistics ? `${number(statistics.earned)} Z` : "—" }, { label: "Продаж", value: statistics?.soldItems ?? "—" }].map((stat) => <div key={stat.label} className="rounded-[18px] border border-white/10 bg-[#0b1017] p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">{stat.label}</p><p className="mt-4 break-words text-xl font-black text-violet-100">{stat.value}</p></div>)}</div>}
      {section === "settings" && <div className="space-y-3 rounded-[18px] border border-white/10 bg-[#0b1017] p-5 text-sm text-slate-300"><div className="flex justify-between gap-4"><span>Имя</span><span className="font-semibold text-white">{data.user.name || "—"}</span></div><div className="flex justify-between gap-4"><span>Email</span><span className="font-semibold text-white">{data.user.email}</span></div><div className="flex justify-between gap-4"><span>Роль</span><span className="font-semibold text-violet-200">{data.user.role === "NPN1_DEV" ? "ZEON NPN 1 DEV" : data.user.role === "DEV" ? "ZEON DEV" : data.user.role === "ADMIN" ? "ZEON ADMIN" : "ZEON USER"}</span></div><div className="flex justify-between gap-4"><span>Авторизация</span><span className="font-semibold text-white">Google</span></div><div className="flex justify-between gap-4"><span>Дата регистрации</span><span className="font-semibold text-white">{date(data.user.createdAt)}</span></div><div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs text-slate-500">Тестовый Beta-доступ сохраняется отдельно от Google-сессии.</p><button type="button" onClick={() => void resetBetaAccess()} className="mt-3 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/10">Сбросить Beta-доступ</button></div></div>}
      {section === "support" && <SupportTicketPanel tickets={data.tickets} onRefresh={load} />}
    </Shell>
  );
}

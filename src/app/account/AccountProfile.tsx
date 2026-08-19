"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState, type FormEvent } from "react";
import SidebarNav from "./SidebarNav";

type InventoryItem = {
  id: string;
  itemId: string;
  name: string;
  rarity: string;
  image: string;
  price: number;
  addedAt: string;
};

type ProfileUser = {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  createdAt: string;
  balance: number;
  role: "USER" | "ADMIN" | "DEV" | "NPN1_DEV";
};

type Operation = {
  id: string;
  type: string;
  itemId: string | null;
  amount: number;
  status: string;
  createdAt: string;
};

type Transaction = {
  id: string;
  type: string;
  rubAmount: number | null;
  zCoinAmount: number;
  status: string;
  createdAt: string;
};

type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};
type Statistics = { inventoryCount: number; inventoryValue: number; openedCases: number; soldItems: number; spent: number; earned: number };

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getDisplayNameFromEmail(email: string | null | undefined): string {
  if (!email) return "—";

  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return "—";

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function HelpTip({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="relative inline-flex h-5 w-5 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/10 text-[0.72rem] font-black text-violet-100 shadow-[0_0_18px_rgba(168,85,247,0.18)]"
      aria-label={title}
    >
      ?
      {open && (
        <span className="absolute right-0 top-7 z-20 w-[220px] rounded-xl border border-violet-500/30 bg-[#0b1220]/95 p-2 text-left text-[0.65rem] leading-4 text-slate-200 shadow-[0_18px_30px_rgba(76,29,149,0.35)]">
          <span className="mb-1 block font-black uppercase tracking-[0.18em] text-violet-200">{title}</span>
          {text}
        </span>
      )}
    </button>
  );
}

export default function AccountProfile() {
  const { data: session } = useSession();
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportDescription, setSupportDescription] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [statistics, setStatistics] = useState<Statistics | null>(null);

  useEffect(() => {
    const syncData = async () => {
      setLoading(true);
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setProfileUser(data.user);
        setInventory(data.inventory);
        setOperations(data.operations);
          setTransactions(data.transactions);
        setTickets(data.tickets);
      }
      const statisticsResponse = await fetch("/api/statistics", { cache: "no-store" });
      if (statisticsResponse.ok) setStatistics(await statisticsResponse.json());
      setLoading(false);
    };

    void syncData();
  }, []);

  const username = profileUser?.name || getDisplayNameFromEmail(profileUser?.email || session?.user?.email);
  const avatar = profileUser?.avatar || session?.user?.image;
  const badge = profileUser?.role === "NPN1_DEV" ? "ZEON NPN 1 DEV" : profileUser?.role === "DEV" ? "ZEON DEV" : profileUser?.role === "ADMIN" ? "ZEON ADMIN" : "ZEON USER";
  const userId = profileUser?.id || "";
  const email = profileUser?.email || session?.user?.email || "";
  const bestDrop = inventory.reduce<InventoryItem | null>((best, item) => {
    if (!best) return item;
    return item.price > best.price ? item : best;
  }, null);
  const legendaryCount = inventory.filter((item) => item.rarity === "Legendary").length;
  const rareCount = inventory.filter((item) => item.rarity === "Rare").length;

  const inventoryHelp = "В инвентаре показываются реальные предметы, которые уже выпали и находятся в профиле пользователя.";
  const statsHelp = "Статистика обновляется на основе фактических данных: числа предметов, суммы инвентаря и количества открытых кейсов.";
  const historyHelp = "История транзакций содержит только финансовые изменения баланса Z-Coin.";
  const settingsHelp = "Настройки содержат только те параметры, которые уже присутствуют в проекте и не создают новых функций.";
  const supportHelp = "Поддержка технически остаётся в рамках текущего проекта без отдельных страниц и дополнительных игровых механик.";

  const reloadProfile = async () => {
    const response = await fetch("/api/profile", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setProfileUser(data.user);
    setInventory(data.inventory);
    setOperations(data.operations);
    setTickets(data.tickets);
    const statisticsResponse = await fetch("/api/statistics", { cache: "no-store" });
    if (statisticsResponse.ok) setStatistics(await statisticsResponse.json());
  };

  const handleSell = async (item: InventoryItem) => {
    if (!window.confirm(`Продать предмет «${item.name}» за ${item.price} Z-Coin?`)) return;
    setActionError("");
    setSellingId(item.id);
    const response = await fetch("/api/inventory/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventoryItemId: item.id }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) setActionError(data?.error || "Не удалось продать предмет");
    else {
      await reloadProfile();
      window.dispatchEvent(new Event("zeon-profile-updated"));
    }
    setSellingId(null);
  };

  const handleSupportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSupportSubmitting(true);
    setActionError("");
    const response = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: supportSubject, description: supportDescription }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) setActionError(data?.error || "Не удалось создать обращение");
    else {
      setSupportSubject("");
      setSupportDescription("");
      await reloadProfile();
    }
    setSupportSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-[#04070d] text-white">
      <div className="mx-auto max-w-[1460px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[26px] border border-violet-500/10 bg-[#060b13] shadow-[0_0_50px_rgba(153,92,255,0.14)]">
          <aside className="flex w-full flex-col bg-[#060b13] lg:flex-row">
            <div className="w-full border-b border-white/10 bg-[#060b13] p-5 lg:w-[260px] lg:border-b-0 lg:border-r">
              <div className="mb-6 flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[1.7rem] font-black tracking-[-0.12em] text-[#f6f1ff]">ZEON</span>
                </div>
                <span className="text-[0.52rem] font-black tracking-[0.42em] text-violet-300/90">GGSTORE</span>
              </div>

              <SidebarNav active="profile" />

            </div>

            <div className="flex-1 bg-[#070d16]">
              <div className="border-b border-white/10 bg-[#070d16]/70 px-5 py-4 sm:px-6 lg:px-7">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Link
                      href="/case"
                      className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:text-violet-100"
                    >
                      Кейсы
                    </Link>
                    <Link
                      href="/account"
                      className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-violet-200 shadow-[0_0_20px_rgba(168,85,247,0.16)]"
                    >
                      Профиль
                    </Link>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-[#0a0f18]/90 px-2 py-1.5">
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-violet-400/50 bg-gradient-to-br from-violet-500/30 to-slate-900/90">
                        <span className="text-[0.62rem] font-black text-violet-100">Z</span>
                      </div>
                      <span className="text-[0.72rem] font-semibold text-slate-200">{username}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 lg:p-7">
                {actionError && <div className="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{actionError}</div>}
                {loading && <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300">Загружаем данные профиля...</div>}
                <div className="grid gap-5">
                  <div className="rounded-[24px] border border-violet-500/20 bg-[#090d17] p-5 shadow-[0_0_30px_rgba(168,85,247,0.08)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-5">
                        <div className="flex h-[108px] w-[108px] items-center justify-center overflow-hidden rounded-full border-[4px] border-violet-400/80 bg-[radial-gradient(circle_at_30%_30%,#ff8a4c,#ff6b1b_55%,#d14d12_100%)] shadow-[0_0_35px_rgba(255,110,58,0.45)]">
                          {avatar ? <Image src={avatar} alt="Аватар пользователя" width={108} height={108} className="h-full w-full object-cover" /> : <span className="text-[3rem] font-black tracking-[-0.12em] text-white">{username.charAt(0).toUpperCase()}</span>}
                        </div>

                        <div className="pt-2">
                          <div className="flex items-center gap-3">
                            <h1 className="text-[2.1rem] font-black tracking-[-0.07em] text-white">{username}</h1>
                            <span className="inline-flex items-center rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-[0.64rem] font-black uppercase tracking-[0.18em] text-violet-100">
                              {badge}
                            </span>
                          </div>

                          <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" aria-hidden="true" />
                            <span>Online</span>
                            <HelpTip title="Онлайн-статус" text="Статус Online определяется активной текущей сессией Google." />
                          </div>

                          <div className="mt-4 flex items-center gap-2 text-[0.86rem] text-slate-300">
                            <span>{email}</span>
                          </div>

                          <div className="mt-3 flex items-center gap-2 text-[0.78rem] text-slate-300">
                            <span className="tracking-[0.18em] text-slate-400">ID:</span>
                            <span className="font-semibold text-violet-100">{userId}</span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(userId)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-[0.72rem] text-slate-300"
                              aria-label="Копировать ID"
                            >
                              ⧉
                            </button>
                          </div>
                          {profileUser && profileUser.role !== "USER" && (
                            <Link href="/admin" className="mt-4 inline-flex rounded-lg border border-violet-400/35 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-100 transition hover:bg-violet-500/20">
                              {profileUser.role === "NPN1_DEV" ? "Developer Console" : profileUser.role === "DEV" ? "Dev Panel" : "Админ-панель"}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    { label: "Открыто кейсов", value: statistics?.openedCases ?? "—", accent: "text-violet-100" },
                    { label: "Лучший дроп", value: bestDrop ? `${bestDrop.price} Z` : "—", accent: "text-yellow-300" },
                    { label: "Пополнено", value: statistics ? `${formatNumber(statistics.earned)} Z` : "—", accent: "text-emerald-300" },
                    { label: "Выведено", value: "—", accent: "text-amber-300" },
                    { label: "Регистрация", value: profileUser ? formatDate(profileUser.createdAt) : "—", accent: "text-slate-200" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[18px] border border-violet-500/15 bg-[#080d16] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.64rem] uppercase tracking-[0.18em] text-slate-400">{item.label}</span>
                        <HelpTip title={item.label} text={statsHelp} />
                      </div>
                      <p className={`mt-3 text-[1.6rem] font-black tracking-[-0.06em] ${item.accent}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                  <section id="inventory" className="rounded-[22px] border border-violet-500/15 bg-[#090d17] p-5 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[1.7rem] font-black tracking-[-0.06em] text-white">Мой инвентарь</h2>
                        <HelpTip title="Инвентарь" text={inventoryHelp} />
                      </div>
                      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-400">{inventory.length} предмета</span>
                    </div>

                    {inventory.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {inventory.map((item) => (
                          <div key={`${item.id}-${item.addedAt}`} className="rounded-[18px] border border-white/10 bg-[#0b1017] p-3">
                            <div className="relative h-[120px] overflow-hidden rounded-[14px] border border-white/10 bg-[#080d15]">
                              <Image src={item.image} alt={item.name} fill className="object-contain" sizes="220px" unoptimized />
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-violet-200">{item.rarity}</span>
                              <span className="rounded-full border border-white/10 bg-white/[0.02] px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-slate-300">В инвентаре</span>
                            </div>

                            <h3 className="mt-2 text-base font-black text-white">{item.name}</h3>

                            <div className="mt-3 rounded-[12px] border border-white/10 bg-white/[0.02] p-2.5">
                              <div className="flex items-center justify-between gap-3 text-[0.7rem] text-slate-300">
                                <span>Стоимость</span>
                                <span className="font-semibold text-violet-100">{item.price} Z</span>
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <span className="text-[0.58rem] uppercase tracking-[0.12em] text-slate-400">Действия</span>
                                <button type="button" onClick={() => void handleSell(item)} disabled={sellingId === item.id} className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-wait disabled:opacity-50">
                                  {sellingId === item.id ? "Продажа..." : "Продать"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-white/10 bg-[#0d131b]/70 p-8 text-center text-slate-300">
                        В инвентаре пока нет предметов.
                      </div>
                    )}
                  </section>

                  <section id="statistics" className="rounded-[22px] border border-violet-500/15 bg-[#090d17] p-5 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[1.6rem] font-black tracking-[-0.06em] text-white">Статистика</h2>
                        <HelpTip title="Статистика" text={statsHelp} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-[16px] border border-white/10 bg-[#0b1017] p-3">
                        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">Предметов в инвентаре</p>
                        <p className="mt-3 text-[1.6rem] font-black tracking-[-0.06em] text-violet-100">{statistics?.inventoryCount ?? "—"}</p>
                      </div>
                      <div className="rounded-[16px] border border-white/10 bg-[#0b1017] p-3">
                        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">Сумма инвентаря</p>
                        <p className="mt-3 text-[1.6rem] font-black tracking-[-0.06em] text-violet-100">{statistics ? `${formatNumber(statistics.inventoryValue)} Z` : "—"}</p>
                      </div>
                      <div className="rounded-[16px] border border-white/10 bg-[#0b1017] p-3">
                        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">Легендарных</p>
                        <p className="mt-3 text-[1.6rem] font-black tracking-[-0.06em] text-yellow-300">{legendaryCount}</p>
                      </div>
                      <div className="rounded-[16px] border border-white/10 bg-[#0b1017] p-3">
                        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">Редких</p>
                        <p className="mt-3 text-[1.6rem] font-black tracking-[-0.06em] text-sky-300">{rareCount}</p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="mt-8 grid gap-5 xl:grid-cols-3">
                  <section id="transactions" className="rounded-[22px] border border-violet-500/15 bg-[#090d17] p-5 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[1.4rem] font-black tracking-[-0.06em] text-white">История транзакций</h2>
                        <HelpTip title="История транзакций" text={historyHelp} />
                      </div>
                    </div>

                    {transactions.length > 0 ? (
                      <div className="space-y-3">
                        {transactions.slice(0, 4).map((transaction) => (
                          <div key={transaction.id} className="flex items-center justify-between rounded-[12px] border border-white/10 bg-[#0b1017] px-3 py-2.5 text-sm text-slate-300">
                            <span className="flex items-center gap-2">
                              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                              {transaction.type === "DEPOSIT" ? "Пополнение баланса" : transaction.type === "PURCHASE" ? "Покупка Z-Coin" : transaction.type === "REFUND" ? "Возврат средств" : transaction.type}
                            </span>
                            <span className="text-right font-semibold text-violet-100">{formatNumber(transaction.zCoinAmount)} Z<br /><span className="text-[0.58rem] font-normal text-slate-400">{formatDateTime(transaction.createdAt)}</span></span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[14px] border border-dashed border-white/10 bg-[#0d131b]/70 p-4 text-sm text-slate-300">
                        Транзакций пока нет
                      </div>
                    )}
                  </section>

                  <section id="settings" className="rounded-[22px] border border-violet-500/15 bg-[#090d17] p-5 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[1.4rem] font-black tracking-[-0.06em] text-white">Настройки</h2>
                        <HelpTip title="Настройки" text={settingsHelp} />
                      </div>
                    </div>

                    <div className="space-y-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between rounded-[12px] border border-white/10 bg-[#0b1017] px-3 py-2.5">
                        <span>Аккаунт</span>
                        <span className="font-semibold text-white">{username}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-[12px] border border-white/10 bg-[#0b1017] px-3 py-2.5">
                        <span>Бейдж</span>
                        <span className="font-semibold text-violet-100">{badge}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-[12px] border border-white/10 bg-[#0b1017] px-3 py-2.5">
                        <span>Статус</span>
                        <span className="font-semibold text-white">Обычный</span>
                      </div>
                    </div>
                  </section>

                  <section id="support" className="rounded-[22px] border border-violet-500/15 bg-[#090d17] p-5 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[1.4rem] font-black tracking-[-0.06em] text-white">Поддержка</h2>
                        <HelpTip title="Поддержка" text={supportHelp} />
                      </div>
                    </div>

                    <form onSubmit={handleSupportSubmit} className="space-y-3">
                      <input value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)} required placeholder="Тема обращения" className="w-full rounded-xl border border-white/10 bg-[#0b1017] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400/50" />
                      <textarea value={supportDescription} onChange={(event) => setSupportDescription(event.target.value)} required placeholder="Описание проблемы" rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-[#0b1017] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400/50" />
                      <button type="submit" disabled={supportSubmitting} className="w-full rounded-xl border border-violet-400/40 bg-violet-500/10 px-3 py-2.5 text-sm font-semibold text-violet-100 disabled:opacity-50">{supportSubmitting ? "Отправка..." : "Создать обращение"}</button>
                    </form>
                    <div className="mt-4 space-y-2">
                      {tickets.length > 0 ? tickets.map((ticket) => (
                        <div key={ticket.id} className="rounded-xl border border-white/10 bg-[#0b1017] p-3 text-sm">
                          <div className="flex items-center justify-between gap-3"><span className="font-semibold text-white">{ticket.subject}</span><span className="text-xs text-violet-200">{ticket.status}</span></div>
                          <p className="mt-1 text-slate-400">{formatDateTime(ticket.createdAt)}</p>
                        </div>
                      )) : <p className="text-sm text-slate-400">Обращений пока нет</p>}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

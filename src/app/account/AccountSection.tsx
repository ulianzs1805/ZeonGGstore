"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AccountShell, { StateMessage } from "./AccountShell";
import InventorySection from "./InventorySection";
import TransactionsSection from "./TransactionsSection";
import StatisticsSection from "./StatisticsSection";
import SettingsSection from "./SettingsSection";
import SupportTicketPanel from "./SupportTicketPanel";
import type { AccountSection as Section, InventoryItem, ProfileData, Statistics } from "./account-types";

export default function AccountSection({ section }: { section: Section }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [error, setError] = useState("");
  const [sellingId, setSellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/profile", { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить данные аккаунта");
    const next = await response.json() as ProfileData;
    setData(next);
    return next;
  }, []);

  const loadStatistics = useCallback(async () => {
    const response = await fetch("/api/statistics", { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить статистику");
    const next = await response.json() as Statistics;
    setStatistics(next);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    setError("");
    const results = await Promise.allSettled([load(), loadStatistics()]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") setError(failed.reason instanceof Error ? failed.reason.message : "Не удалось обновить данные");
  }, [load, loadStatistics]);

  useEffect(() => { void refresh(); }, [refresh]);

  const sell = useCallback(async (item: InventoryItem) => {
    if (!window.confirm(`Продать предмет «${item.name}» за ${item.price} Z-Coin?`)) return;
    setSellingId(item.id);
    setError("");
    try {
      const response = await fetch("/api/inventory/sell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inventoryItemId: item.id }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Не удалось продать предмет");
      await refresh();
      window.dispatchEvent(new Event("zeon-profile-updated"));
    } catch (sellError) {
      setError(sellError instanceof Error ? sellError.message : "Не удалось продать предмет");
    } finally {
      setSellingId(null);
    }
  }, [refresh]);

  const resetBetaAccess = useCallback(async () => {
    try {
      const response = await fetch("/api/beta", { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось сбросить Beta-доступ");
      window.location.href = "/beta";
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Не удалось сбросить Beta-доступ");
    }
  }, []);

  const bestDrop = useMemo(() => data?.inventory.reduce<InventoryItem | null>((best, item) => !best || item.price > best.price ? item : best, null) ?? null, [data?.inventory]);
  const title = section === "inventory" ? "Инвентарь" : section === "transactions" ? "История транзакций" : section === "statistics" ? "Статистика" : section === "settings" ? "Настройки" : "Поддержка";

  if (!data && error) return <AccountShell active={section} title="Аккаунт"><StateMessage>{error}</StateMessage></AccountShell>;
  if (!data) return <AccountShell active={section} title="Аккаунт"><StateMessage>Загружаем данные...</StateMessage></AccountShell>;

  return <AccountShell active={section} title={title}>
    {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
    {section === "inventory" && <InventorySection items={data.inventory} sellingId={sellingId} onSell={(item) => void sell(item)} />}
    {section === "transactions" && <TransactionsSection transactions={data.transactions} />}
    {section === "statistics" && <StatisticsSection statistics={statistics} bestDrop={bestDrop} />}
    {section === "settings" && <SettingsSection user={data.user} onResetBeta={() => void resetBetaAccess()} />}
    {section === "support" && <SupportTicketPanel tickets={data.tickets} onRefresh={async () => { await load(); }} />}
  </AccountShell>;
}

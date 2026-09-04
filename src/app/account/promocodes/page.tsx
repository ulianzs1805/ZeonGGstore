"use client";

import { useCallback, useEffect, useState } from "react";
import AccountShell, { StateMessage } from "../AccountShell";
import type { AccountUser } from "../account-types";

type Promo = { id: string; code: string; type: "DEPOSIT" | "CASE" | "ZCOIN"; zCoinAmount: number | null; depositPercent: number | null; caseId: string | null; expiresAt: string; activationCount: number; maxActivations: number };

const typeLabel = (promo: Promo) => promo.type === "DEPOSIT" ? `На депозит • +${promo.depositPercent ?? 0}%` : promo.type === "CASE" ? "На кейсы" : `На койны • +${promo.zCoinAmount ?? 0} Z-Coin`;

export default function PromoInventoryPage() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [profileResponse, promoResponse] = await Promise.all([fetch("/api/profile", { cache: "no-store" }), fetch("/api/promos/inventory", { cache: "no-store" })]);
      const profile = await profileResponse.json().catch(() => null);
      const data = await promoResponse.json().catch(() => null);
      if (!profileResponse.ok) throw new Error(profile?.error || "Не удалось загрузить аккаунт");
      if (!promoResponse.ok) throw new Error(data?.error || "Не удалось загрузить промокоды");
      setUser(profile.user); setPromos(data.promos ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось загрузить промокоды"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <AccountShell active="promocodes" title="Промокоды" user={user ?? undefined}>
    {loading ? <StateMessage>Загружаем промокоды...</StateMessage> : error ? <StateMessage>{error}</StateMessage> : !promos.length ? <StateMessage>Промокодов пока нет. Выиграй бонус в Барабане или добавь код в инвентарь.</StateMessage> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{promos.map((promo) => <article key={promo.id} className="rounded-[20px] border border-orange-300/15 bg-[#090d15] p-5"><div className="flex items-center justify-between gap-3"><span className="rounded-full border border-orange-300/20 bg-orange-400/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-orange-200">Промокод</span><span className="text-[9px] text-slate-500">{new Date(promo.expiresAt).toLocaleDateString("ru-RU")}</span></div><div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-3 py-4 text-center font-mono text-2xl font-black tracking-[.2em] text-white">{promo.code}</div><p className="mt-3 text-center text-xs font-bold text-orange-200">{typeLabel(promo)}</p><button type="button" onClick={() => { window.location.href = `/bonuses/promocodes?code=${encodeURIComponent(promo.code)}`; }} className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3 text-[10px] font-black uppercase tracking-[.12em]">Использовать</button></article>)}</div>}
  </AccountShell>;
}

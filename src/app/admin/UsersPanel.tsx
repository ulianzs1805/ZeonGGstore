"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string | null; email: string; role: string; balance: number; inventoryCount: number; staffId: string | null; createdAt: string };
type BalanceAction = { user: User; amount: number };
const formatBalance = (value: number) => new Intl.NumberFormat("ru-RU").format(Number.isFinite(value) ? value : 0);
const formatDate = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "short" }).format(new Date(value));
const roleLabel = (role: string) => role === "NPN1_DEV" ? "NPN1 DEV" : role === "DEV" ? "DEV" : role === "ADMIN" ? "ADMIN" : role === "TESTER" ? "TESTER" : "USER";

export default function UsersPanel({ canAdjustBalance = true }: { canAdjustBalance?: boolean }) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [balanceAction, setBalanceAction] = useState<BalanceAction | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = async (value: string) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/users${value ? `?search=${encodeURIComponent(value)}` : ""}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Не удалось загрузить пользователей");
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить пользователей");
    } finally { setLoading(false); }
  };

  useEffect(() => { const timer = window.setTimeout(() => void load(search.trim()), 250); return () => window.clearTimeout(timer); }, [search]);

  const openBalanceAction = (user: User, direction: 1 | -1) => {
    setBalanceAction({ user, amount: direction }); setAmount(""); setReason(""); setActionError("");
  };

  const submitBalanceAction = async () => {
    if (!balanceAction) return;
    const parsed = Number(amount);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 1_000_000_000) { setActionError("Введите целое число от 1 до 1 000 000 000."); return; }
    if (balanceAction.amount < 0 && parsed > balanceAction.user.balance) { setActionError("Нельзя списать больше, чем есть на балансе пользователя."); return; }
    setSaving(true); setActionError("");
    try {
      const response = await fetch("/api/admin/users/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: balanceAction.user.id, amount: parsed * balanceAction.amount, reason: reason.trim() || undefined }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Не удалось изменить баланс");
      setUsers((current) => current.map((user) => user.id === balanceAction.user.id ? { ...user, balance: data.balance } : user));
      setBalanceAction(null);
    } catch (saveError) { setActionError(saveError instanceof Error ? saveError.message : "Не удалось изменить баланс"); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-black">Пользователи</h2><p className="mt-2 text-sm text-slate-400">Поиск аккаунтов, контроль Z-Coin и быстрые административные действия. Изменения баланса записываются в Z-Coin Operations и Audit Log.</p></div>
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Email, User ID или имя" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-violet-300/50" />
    {loading && <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">Загрузка...</p>}
    {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200"><span>{error}</span><button type="button" onClick={() => void load(search.trim())} className="rounded-lg border border-red-300/30 px-3 py-2 font-bold">Повторить</button></div>}
    {!loading && !error && !users.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">{search ? "Пользователи не найдены." : "Пока нет пользователей."}</p>}
    {!loading && !error && users.length > 0 && <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="hidden grid-cols-[1.2fr_1.4fr_0.7fr_0.9fr_0.8fr_1fr_1.5fr] gap-3 bg-white/[0.04] px-4 py-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-400 lg:grid"><span>User</span><span>Email</span><span>Role</span><span>Staff ID</span><span>Z-Coin</span><span>Inventory</span><span>Actions</span></div>
      <div className="divide-y divide-white/10">{users.map((user) => <article key={user.id} className="grid gap-3 bg-black/10 p-4 lg:grid-cols-[1.2fr_1.4fr_0.7fr_0.9fr_0.8fr_1fr_1.5fr] lg:items-center lg:gap-3 lg:px-4 lg:py-3"><div className="min-w-0"><p className="truncate font-bold text-white">{user.name || "Без имени"}</p><p className="mt-1 truncate text-xs text-slate-500" title={user.id}>ID: {user.id.slice(0, 8)}…</p></div><p className="truncate text-sm text-slate-300">{user.email}</p><span className="w-fit rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-1 text-xs font-bold text-violet-100">{roleLabel(user.role)}</span><p className="truncate text-xs text-slate-400">{user.staffId ?? "—"}</p><p className="text-sm font-bold text-violet-100">{formatBalance(user.balance)} Z</p><p className="text-sm text-slate-300">{user.inventoryCount} items</p><div className="flex flex-wrap gap-2">{canAdjustBalance && <><button type="button" onClick={() => openBalanceAction(user, 1)} className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-400/20">+ Z-Coin</button><button type="button" onClick={() => openBalanceAction(user, -1)} className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-100 hover:bg-rose-400/20">− Z-Coin</button></>}<span className="w-full text-[0.65rem] text-slate-500">Регистрация: {formatDate(user.createdAt)}</span></div></article>)}</div>
    </div>}
    {balanceAction && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="balance-dialog-title"><div className="w-full max-w-md rounded-3xl border border-violet-300/20 bg-[#0b0715] p-6 shadow-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Z-COIN CONTROL</p><h3 id="balance-dialog-title" className="mt-2 text-xl font-black">{balanceAction.amount > 0 ? "Кинуть Z-Coin" : "Списать Z-Coin"}</h3><p className="mt-2 text-sm text-slate-400">{balanceAction.user.name || balanceAction.user.email} · текущий баланс {formatBalance(balanceAction.user.balance)} Z</p><label className="mt-5 block text-sm font-bold text-slate-200">Сумма<input autoFocus inputMode="numeric" min="1" max="1000000000" step="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Например, 1000" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-violet-300/50" /></label><label className="mt-4 block text-sm font-bold text-slate-200">Причина <span className="font-normal text-slate-500">(необязательно)</span><input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} placeholder="Например: компенсация" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-violet-300/50" /></label>{actionError && <p className="mt-3 rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-200">{actionError}</p>}<div className="mt-6 flex gap-3"><button type="button" disabled={saving} onClick={() => setBalanceAction(null)} className="flex-1 rounded-xl border border-white/10 px-4 py-3 font-bold text-slate-300">Отмена</button><button type="button" disabled={saving} onClick={() => void submitBalanceAction()} className="flex-1 rounded-xl bg-violet-500 px-4 py-3 font-black text-white disabled:opacity-50">{saving ? "Сохраняем…" : "Подтвердить"}</button></div></div></div>}
  </div>;
}

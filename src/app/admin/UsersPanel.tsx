"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string | null; email: string; role: string; balance: number; inventoryCount: number; staffId: string | null; createdAt: string };

const formatBalance = (value: number) => new Intl.NumberFormat("ru-RU").format(Number.isFinite(value) ? value : 0);
const formatDate = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "short" }).format(new Date(value));
const roleLabel = (role: string) => role === "NPN1_DEV" ? "NPN1 DEV" : role === "DEV" ? "DEV" : role === "ADMIN" ? "ADMIN" : "USER";

export default function UsersPanel() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (value: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users${value ? `?search=${encodeURIComponent(value)}` : ""}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Не удалось загрузить пользователей");
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-black">Пользователи</h2><p className="mt-2 text-sm text-slate-400">Аккаунты из Prisma без mutation-действий в этом разделе.</p></div>
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Email, User ID или имя" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-violet-300/50" />
    {loading && <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">Загрузка...</p>}
    {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200"><span>{error}</span><button type="button" onClick={() => void load(search.trim())} className="rounded-lg border border-red-300/30 px-3 py-2 font-bold">Повторить</button></div>}
    {!loading && !error && !users.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">{search ? "Пользователи не найдены." : "Пока нет пользователей."}</p>}
    {!loading && !error && users.length > 0 && <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="hidden grid-cols-[1.2fr_1.4fr_0.7fr_0.9fr_0.8fr_1fr_0.8fr] gap-3 bg-white/[0.04] px-4 py-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-400 lg:grid"><span>User</span><span>Email</span><span>Role</span><span>Staff ID</span><span>Z-Coin</span><span>Inventory</span><span>Registered</span></div>
      <div className="divide-y divide-white/10">{users.map((user) => <article key={user.id} className="grid gap-3 bg-black/10 p-4 lg:grid-cols-[1.2fr_1.4fr_0.7fr_0.9fr_0.8fr_1fr_0.8fr] lg:items-center lg:gap-3 lg:px-4 lg:py-3"><div className="min-w-0"><p className="truncate font-bold text-white">{user.name || "Без имени"}</p><p className="mt-1 truncate text-xs text-slate-500" title={user.id}>ID: {user.id.slice(0, 8)}…</p></div><p className="truncate text-sm text-slate-300">{user.email}</p><span className="w-fit rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-1 text-xs font-bold text-violet-100">{roleLabel(user.role)}</span><p className="truncate text-xs text-slate-400">{user.staffId ?? "—"}</p><p className="text-sm font-bold text-violet-100">{formatBalance(user.balance)} Z</p><p className="text-sm text-slate-300">{user.inventoryCount} items</p><p className="text-sm text-slate-400">{formatDate(user.createdAt)}</p></article>)}</div>
    </div>}
  </div>;
}
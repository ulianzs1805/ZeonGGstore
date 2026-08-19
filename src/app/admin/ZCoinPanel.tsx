"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string | null; email: string; avatar: string | null; balance: number; role: string };
type Overview = { actor: { email: string; name: string | null; role: string; staffId: string | null }; policy: Record<string, number>; used: { grant: number; revoke: number; total: number } };
type History = { id: string; operation: string; amount: number; oldBalance: number; newBalance: number; reason: string; status: string; createdAt: string; target: { email: string; name: string | null } };

const format = (value: number) => new Intl.NumberFormat("ru-RU").format(value);

export default function ZCoinPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<User | null>(null);
  const [operation, setOperation] = useState<"GRANT" | "REVOKE">("GRANT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoadError("");
    const [overviewResponse, historyResponse] = await Promise.all([fetch("/api/admin/zcoin", { cache: "no-store" }), fetch("/api/admin/zcoin?mode=history", { cache: "no-store" })]);
    const overviewData = await overviewResponse.json().catch(() => null);
    const historyData = await historyResponse.json().catch(() => null);
    if (!overviewResponse.ok || !historyResponse.ok) { setLoadError(overviewData?.error || historyData?.error || "Не удалось загрузить Z-Coin данные"); return; }
    setOverview(overviewData);
    setHistory(Array.isArray(historyData?.history) ? historyData.history : []);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (search.trim().length < 2) { setUsers([]); return; }
    const timer = window.setTimeout(() => { void fetch(`/api/admin/zcoin?mode=users&search=${encodeURIComponent(search)}`).then((response) => response.json()).then((data) => setUsers(data.users ?? [])); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const submit = async () => {
    if (!target) return;
    if (!valid) return;
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/zcoin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: target.id, operation, amount: Number(amount), reason, idempotencyKey: crypto.randomUUID() }) });
    const data = await response.json().catch(() => null);
    setMessage(response.ok ? "Операция успешно выполнена." : data?.error || "Операция отклонена.");
    if (response.ok) { setAmount(""); setReason(""); await load(); }
    setBusy(false);
  };
  const numericAmount = Number(amount);
  const valid = Boolean(target && Number.isSafeInteger(numericAmount) && numericAmount > 0 && reason.trim().length >= 5);
  const isNpn = overview?.actor.role === "NPN1_DEV";
  const operationLimit = operation === "GRANT" ? overview?.policy.DEV_GRANT_PER_OPERATION : overview?.policy.DEV_REVOKE_PER_OPERATION;
  const nextBalance = target ? operation === "GRANT" ? target.balance + (Number.isFinite(numericAmount) ? numericAmount : 0) : target.balance - (Number.isFinite(numericAmount) ? numericAmount : 0) : 0;
  return <div className="space-y-5"><div className="rounded-2xl border border-violet-300/20 bg-violet-400/5 p-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Управление Z-Coin</p><h2 className="mt-2 text-2xl font-black">Ручное управление балансом пользователей</h2><p className="mt-3 text-sm text-slate-300">{overview?.actor.role === "NPN1_DEV" ? "ZEON NPN 1 DEV · ограничения DEV не применяются" : "ZEON DEV · операции проходят через ZCoinPolicy"}</p><p className="mt-1 break-all text-xs text-slate-400">{overview?.actor.email ?? "—"} · Staff ID: {overview?.actor.staffId ?? "—"}</p></div>
    {loadError && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200"><span>{loadError}</span><button type="button" onClick={() => void load()} className="rounded-lg border border-red-300/30 px-3 py-2 font-bold">Повторить</button></div>}
    {overview && <div className="grid gap-3 sm:grid-cols-3">{[["Начислено", overview.used.grant, overview.policy.DEV_GRANT_DAILY_LIMIT], ["Списано", overview.used.revoke, overview.policy.DEV_REVOKE_DAILY_LIMIT], ["Всего", overview.used.total, overview.policy.DEV_TOTAL_DAILY_LIMIT]].map(([label, used, limit]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 font-black text-violet-200">{isNpn ? "Расширенный доступ" : `${format(Number(used))} / ${format(Number(limit))} Z`}</p>{!isNpn && <div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.min(100, Number(used) / Number(limit) * 100)}%` }} /></div>}</div>)}</div>}
    <div className="rounded-2xl border border-white/10 bg-black/15 p-5"><label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Пользователь</label><input value={target ? target.email : search} onChange={(event) => { setTarget(null); setSearch(event.target.value); }} placeholder="Найти пользователя..." className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm" />{users.length > 0 && <div className="mt-2 space-y-1">{users.map((user) => <button key={user.id} type="button" onClick={() => { setTarget(user); setUsers([]); }} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-violet-400/10">{user.name || user.email} · {user.email} · {format(user.balance)} Z</button>)}</div>}{target && <p className="mt-3 text-sm text-violet-200">{target.name || "—"} · {target.email} · User ID: {target.id} · Баланс: {format(target.balance)} Z</p>}</div>
    <div className="rounded-2xl border border-white/10 bg-black/15 p-5"><div className="flex gap-2"><button type="button" onClick={() => setOperation("GRANT")} className={`flex-1 rounded-xl px-4 py-3 text-sm font-black ${operation === "GRANT" ? "bg-emerald-500/20 text-emerald-200" : "border border-white/10 text-slate-400"}`}>+ Z-Coin</button><button type="button" onClick={() => setOperation("REVOKE")} className={`flex-1 rounded-xl px-4 py-3 text-sm font-black ${operation === "REVOKE" ? "bg-red-500/20 text-red-200" : "border border-white/10 text-slate-400"}`}>- Z-Coin</button></div><input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Количество Z-Coin" className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm" /><p className="mt-2 text-xs text-slate-500">Лимит одной операции: {isNpn ? "расширенный доступ" : operationLimit ? `${format(operationLimit)} Z` : "—"}</p><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Причина операции (минимум 5 символов)" className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm" />{target && <div className="mt-4 rounded-xl border border-white/10 p-4 text-sm text-slate-300">Текущий баланс: <b>{format(target.balance)} Z</b><br />Операция: <b>{operation === "GRANT" ? "+" : "-"}{format(Number.isFinite(numericAmount) ? numericAmount : 0)} Z</b><br />Новый баланс: <b>{format(nextBalance)} Z</b>{!isNpn && operationLimit && numericAmount > operationLimit && <p className="mt-2 text-red-300">Превышен лимит одной операции.</p>}</div>}<button type="button" onClick={() => void submit()} disabled={!valid || (!isNpn && operationLimit !== undefined && numericAmount > operationLimit) || (operation === "REVOKE" && nextBalance < 0) || busy} className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-black disabled:opacity-40">{busy ? "Выполняем..." : "Подтвердить операцию"}</button>{message && <p className="mt-3 rounded-xl border border-white/10 p-3 text-sm text-slate-300">{message}</p>}</div>
    <div className="rounded-2xl border border-white/10 bg-black/15 p-5"><h3 className="font-black">История ручных операций</h3><div className="mt-3 space-y-2">{history.length ? history.map((item) => <div key={item.id} className="rounded-xl border border-white/10 p-3 text-xs text-slate-300">{item.operation} · {format(item.amount)} Z · {item.target.email}<br />{item.oldBalance} → {item.newBalance} Z · {item.reason}</div>) : <p className="text-sm text-slate-500">Операций пока нет.</p>}</div></div>
  </div>;
}
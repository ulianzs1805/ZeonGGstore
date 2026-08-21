"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string | null; email: string; balance: number };
type CatalogDrop = { id: string; name: string; rarity: string; probability: number };
type CatalogCase = { id: string; slug: string; name: string; isActive: boolean; drops: CatalogDrop[] };

export default function ForceDropPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [cases, setCases] = useState<CatalogCase[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [dropId, setDropId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const selectedCase = cases.find((item) => item.id === caseId);
  const drops = selectedCase?.drops ?? [];

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [usersResponse, casesResponse] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/cases", { cache: "no-store" }),
      ]);
      const [userData, caseData] = await Promise.all([
        usersResponse.json().catch(() => null),
        casesResponse.json().catch(() => null),
      ]);
      if (!usersResponse.ok || !casesResponse.ok) {
        throw new Error(userData?.error || caseData?.error || "Не удалось загрузить данные Force Drop");
      }
      setUsers(Array.isArray(userData?.users) ? userData.users : []);
      setCases(Array.isArray(caseData?.cases) ? caseData.cases : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить данные Force Drop");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/force-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, caseId, dropId, reason: reason.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Force Drop отклонён.");
      setMessage(data?.message || "Drop назначен.");
      setDropId("");
      setReason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось назначить Force Drop.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black">Force Drop / Test Drop</h2>
        <p className="mt-2 text-sm text-amber-200">Только NPN1. Probability и экономика кейса не изменяются.</p>
      </div>

      {loading ? (
        <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">Загрузка...</p>
      ) : (
        <div className="grid gap-3">
          <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} className="min-w-0 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
            <option value="">Выберите пользователя</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email} · {user.email}</option>)}
          </select>
          <select value={caseId} onChange={(event) => { setCaseId(event.target.value); setDropId(""); }} className="min-w-0 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
            <option value="">Выберите активный кейс</option>
            {cases.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={dropId} onChange={(event) => setDropId(event.target.value)} disabled={!caseId} className="min-w-0 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm disabled:opacity-50">
            <option value="">Выберите Drop</option>
            {drops.map((drop) => <option key={drop.id} value={drop.id}>{drop.name} · {drop.rarity} · {drop.probability}%</option>)}
          </select>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Причина (минимум 5 символов)" className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-sm" />
          <button type="button" disabled={busy || !targetUserId || !caseId || !dropId || reason.trim().length < 5} onClick={() => void submit()} className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? "Выполняем..." : "Подтвердить тестовую выдачу"}
          </button>
        </div>
      )}

      {message && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm text-slate-200">
          <span className="min-w-0 flex-1 break-words">{message}</span>
          {!loading && <button type="button" onClick={() => void load()} className="shrink-0 text-xs font-bold text-violet-200">Повторить</button>}
        </div>
      )}
    </div>
  );
}

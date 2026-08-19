"use client";

import { useEffect, useState } from "react";

export default function DashboardPanel() {
  const [data, setData] = useState<{ users: number; admins: number; devs: number; cases: number; drops: number } | null>(null);
  const [error, setError] = useState("");
  const load = async () => {
    setError("");
    try {
      const [usersResponse, casesResponse] = await Promise.all([fetch("/api/admin/users", { cache: "no-store" }), fetch("/api/admin/cases", { cache: "no-store" })]);
      const [userData, caseData] = await Promise.all([usersResponse.json().catch(() => null), casesResponse.json().catch(() => null)]);
      if (!usersResponse.ok || !casesResponse.ok) throw new Error(userData?.error || caseData?.error || "Не удалось загрузить данные");
      const users = Array.isArray(userData?.users) ? userData.users : [];
      const cases = Array.isArray(caseData?.cases) ? caseData.cases : [];
      setData({ users: users.length, admins: users.filter((user: { role: string }) => user.role === "ADMIN").length, devs: users.filter((user: { role: string }) => user.role === "DEV" || user.role === "NPN1_DEV").length, cases: cases.length, drops: cases.reduce((sum: number, item: { drops?: unknown[] }) => sum + (Array.isArray(item.drops) ? item.drops.length : 0), 0) });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные");
    }
  };
  useEffect(() => { void load(); }, []);
  if (error) return <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg border border-red-300/30 px-3 py-2 font-bold">Повторить</button></div>;
  if (!data) return <div className="space-y-4"><div><h2 className="text-2xl font-black">Обзор</h2><p className="mt-2 text-sm text-slate-400">Загрузка данных панели...</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />)}</div></div>;
  return <div><h2 className="text-2xl font-black">Обзор</h2><p className="mt-2 text-sm text-slate-400">Сводка по данным панели из Prisma.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["Пользователи", data.users], ["ADMIN", data.admins], ["DEV / NPN1", data.devs], ["Активные кейсы", data.cases], ["Drops", data.drops]].map(([label, value]) => <div key={String(label)} className="flex min-h-28 flex-col justify-between rounded-2xl border border-white/10 bg-black/15 p-5"><p className="text-xs uppercase tracking-[0.15em] text-slate-400">{label}</p><p className="mt-3 text-3xl font-black text-violet-200">{Number.isFinite(Number(value)) ? value : 0}</p></div>)}</div></div>;
}
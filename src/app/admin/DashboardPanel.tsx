"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Role } from "./types/admin";

type DashboardPanelProps = { role: Role; email: string; staffId: string | null; };
export default function DashboardPanel({ role, email, staffId }: DashboardPanelProps) {
  const [data,setData]=useState<{users:number;admins:number;devs:number;cases:number;drops:number}|null>(null); const [error,setError]=useState("");
  const load=async()=>{setError("");try{const [u,c]=await Promise.all([fetch("/api/admin/users",{cache:"no-store"}),fetch("/api/admin/cases",{cache:"no-store"})]);const [ud,cd]=await Promise.all([u.json().catch(()=>null),c.json().catch(()=>null)]);if(!u.ok||!c.ok)throw new Error(ud?.error||cd?.error||"Не удалось загрузить данные");const users=Array.isArray(ud?.users)?ud.users:[];const cases=Array.isArray(cd?.cases)?cd.cases:[];setData({users:users.length,admins:users.filter((x:{role:string})=>x.role==="ADMIN").length,devs:users.filter((x:{role:string})=>x.role==="DEV"||x.role==="NPN1_DEV").length,cases:cases.length,drops:cases.reduce((s:number,x:{drops?:unknown[]})=>s+(Array.isArray(x.drops)?x.drops.length:0),0)});}catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить данные");}};
  useEffect(()=>{void load();},[]);
  if(error)return <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200"><p>{error}</p><button type="button" onClick={()=>void load()} className="mt-3 rounded-lg border border-red-300/30 px-3 py-2 font-bold">Повторить</button></div>;
  if(!data)return <div className="space-y-4"><div><h2 className="text-2xl font-black">Обзор</h2><p className="mt-2 text-sm text-slate-400">Загрузка данных панели...</p></div></div>;
  return <div><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-black">Обзор</h2><p className="mt-2 text-sm text-slate-400">Сводка по данным панели из Prisma.</p><p className="mt-1 text-xs text-slate-500">{email} · {role}{staffId?` · Staff: ${staffId}`:""}</p></div><Link href="/admin/promos" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-4 py-3 text-sm font-black text-violet-100">Создать промокод</Link></div><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["Пользователи",data.users],["ADMIN",data.admins],["DEV / NPN1",data.devs],["Активные кейсы",data.cases],["Drops",data.drops]].map(([label,value])=><div key={String(label)} className="flex min-h-28 flex-col justify-between rounded-2xl border border-white/10 bg-black/15 p-5"><p className="text-xs uppercase tracking-[0.15em] text-slate-400">{label}</p><p className="mt-3 text-3xl font-black text-violet-200">{Number.isFinite(Number(value))?value:0}</p></div>)}</div></div>;
}

"use client";

import Link from "next/link";
import { useState } from "react";
import AdminSupportPanel from "./AdminSupportPanel";
import DashboardPanel from "./DashboardPanel";
import DevConsolePanel from "./DevConsolePanel";
import ForceDropPanel from "./ForceDropPanel";
import FortuneBypassPanel from "./FortuneBypassPanel";
import RoleManagementPanel from "./RoleManagementPanel";
import SkinPricePanel from "./SkinPricePanel";
import UsersPanel from "./UsersPanel";
import ZCoinPanel from "./ZCoinPanel";
import WithdrawalPanel from "./WithdrawalPanel";

type Role = "ADMIN" | "DEV" | "NPN1_DEV" | "TESTER";
type Section = "dashboard" | "users" | "roles" | "support" | "zcoin" | "console" | "force" | "skinPrices" | "fortune" | "withdrawals";

export default function AdminPanel({ role, email, staffId }: { role: Role; email: string; staffId: string | null }) {
  const [section, setSection] = useState<Section>("dashboard"); const isDev = role === "DEV" || role === "NPN1_DEV"; const isNpn = role === "NPN1_DEV";
  const tabs: Array<{ id: Section; label: string; visible: boolean }> = [
    { id: "dashboard", label: "Обзор", visible: true }, { id: "users", label: "Пользователи", visible: true }, { id: "roles", label: "Роли", visible: isDev }, { id: "support", label: "Поддержка", visible: true }, { id: "zcoin", label: "Z-Coin", visible: isDev }, { id: "console", label: "Dev Console", visible: isDev }, { id: "force", label: "Force Drop", visible: isNpn }, { id: "skinPrices", label: "Стоимость скинов", visible: isDev }, { id: "fortune", label: "Барабан", visible: isDev }, { id: "withdrawals", label: "Выводы скинов", visible: true },
  ];
  const renderSection = () => {
    if (section === "dashboard") return <DashboardPanel role={role} email={email} staffId={staffId} />; if (section === "users") return <UsersPanel />; if (section === "roles") return isDev ? <RoleManagementPanel role={role} /> : null; if (section === "support") return <AdminSupportPanel />; if (section === "zcoin") return isDev ? <ZCoinPanel /> : null; if (section === "console") return isDev ? <DevConsolePanel /> : null; if (section === "force") return isNpn ? <ForceDropPanel /> : null; if (section === "skinPrices") return isDev ? <SkinPricePanel role={role} /> : null; if (section === "fortune") return isDev ? <FortuneBypassPanel /> : null; if (section === "withdrawals") return <WithdrawalPanel />; return null;
  };
  return <div className="min-h-screen overflow-x-hidden bg-slate-950 text-white"><header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><Link href="/" className="font-black text-violet-200">ZeonGGStore</Link><div className="min-w-0 text-right text-xs text-slate-400"><p className="truncate">{email}</p><p>{role}{staffId ? ` · ${staffId}` : ""}</p></div></div></header><div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row"><aside className="lg:w-60 lg:shrink-0"><nav className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/15 p-3 sm:grid-cols-4 lg:grid-cols-1">{tabs.filter((tab) => tab.visible).map((tab) => <button key={tab.id} type="button" onClick={() => setSection(tab.id)} className={`rounded-xl px-3 py-3 text-left text-sm font-bold transition ${section === tab.id ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-300/30" : "text-slate-300 hover:bg-white/5"}`}>{tab.label}</button>)}</nav></aside><main className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-6">{renderSection()}</main></div></div>;
}

"use client";

import type { Role, Section } from "../types/admin";

export type AdminNavItem = { id: Section; label: string; visible: boolean };

export function getAdminSections(role: Role): AdminNavItem[] {
  return [
    { id: "dashboard", label: "Обзор", visible: true },
    { id: "create", label: "Создать кейс", visible: true },
    { id: "cases", label: "Управление кейсами", visible: true },
    { id: "drops", label: "Дропы", visible: true },
    { id: "users", label: "Пользователи", visible: true },
    { id: "roles", label: "Выдать роль", visible: role === "DEV" || role === "NPN1_DEV" },
    { id: "support", label: "Поддержка", visible: true },
    { id: "myAudit", label: "Мои действия", visible: true },
    { id: "economy", label: "Экономика", visible: role !== "ADMIN" },
    { id: "transactions", label: "Транзакции", visible: role !== "ADMIN" },
    { id: "zcoin", label: "Z-Coin", visible: role !== "ADMIN" },
    { id: "console", label: "Dev Console", visible: role !== "ADMIN" },
    { id: "audit", label: "Audit Logs", visible: role !== "ADMIN" },
    { id: "force", label: "Force Drop / Test Drop", visible: role === "NPN1_DEV" },
    { id: "skinPrices", label: "Стоимость скинов", visible: role === "DEV" || role === "NPN1_DEV" },
    { id: "tester", label: "Tester Tools", visible: role === "TESTER" || role === "DEV" || role === "NPN1_DEV" },
    { id: "tools", label: "Developer Tools", visible: role !== "ADMIN" },
  ].filter((item) => item.visible);
}

export function AdminNavigation({ items, section, onChange }: { items: AdminNavItem[]; section: Section; onChange: (section: Section) => void }) {
  return <nav className="space-y-1">{items.map((item) => <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold ${section === item.id ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{item.label}</button>)}</nav>;
}

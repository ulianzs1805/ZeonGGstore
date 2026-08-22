"use client";

import type { Role, Section } from "../types/admin";

export type AdminNavItem = {
  id: Section;
  label: string;
  visible: boolean;
};

const ADMIN_SECTIONS: AdminNavItem[] = [
  { id: "dashboard", label: "Обзор", visible: true },
  { id: "create", label: "Создать кейс", visible: true },
  { id: "cases", label: "Управление кейсами", visible: true },
  { id: "drops", label: "Дропы", visible: true },
  { id: "users", label: "Пользователи", visible: true },
  { id: "roles", label: "Выдать роль", visible: false },
  { id: "support", label: "Поддержка", visible: true },
  { id: "myAudit", label: "Мои действия", visible: true },
  { id: "economy", label: "Экономика", visible: false },
  { id: "transactions", label: "Транзакции", visible: false },
  { id: "zcoin", label: "Z-Coin", visible: false },
  { id: "console", label: "Dev Console", visible: false },
  { id: "audit", label: "Audit Logs", visible: false },
  { id: "force", label: "Force Drop / Test Drop", visible: false },
  { id: "skinPrices", label: "Стоимость скинов", visible: false },
  { id: "tester", label: "Tester Tools", visible: false },
  { id: "tools", label: "Developer Tools", visible: false },
];

export function getAdminSections(role: Role): AdminNavItem[] {
  return ADMIN_SECTIONS.map((item) => ({
    ...item,
    visible:
      item.id === "roles"
        ? role === "DEV" || role === "NPN1_DEV"
        : item.id === "economy" || item.id === "transactions" || item.id === "zcoin" || item.id === "console" || item.id === "audit" || item.id === "tools"
          ? role !== "ADMIN"
          : item.id === "force"
            ? role === "NPN1_DEV"
            : item.id === "skinPrices"
              ? role === "DEV" || role === "NPN1_DEV"
              : item.id === "tester"
                ? role === "TESTER" || role === "DEV" || role === "NPN1_DEV"
                : item.visible,
  })).filter((item) => item.visible);
}

export function AdminNavigation({ items, section, onChange }: { items: AdminNavItem[]; section: Section; onChange: (section: Section) => void }) {
  return <nav className="space-y-1">{items.map((item) => <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold ${section === item.id ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{item.label}</button>)}</nav>;
}

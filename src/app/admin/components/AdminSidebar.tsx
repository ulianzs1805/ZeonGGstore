"use client";

export type AdminSection = "dashboard" | "create" | "cases" | "drops" | "support" | "users" | "roles" | "myAudit" | "audit" | "economy" | "transactions" | "zcoin" | "console" | "force" | "tools" | "tester" | "skinPrices";

export type AdminNavItem = { id: AdminSection; label: string; visible: boolean };

export default function AdminSidebar({ items, section, onSelect }: { items: AdminNavItem[]; section: AdminSection; onSelect: (section: AdminSection) => void }) {
  return <nav className="sticky top-20 space-y-1">{items.filter((item) => item.visible).map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold ${section === item.id ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{item.label}</button>)}</nav>;
}

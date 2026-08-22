"use client";

import type { AdminNavItem, AdminSection } from "./AdminSidebar";

export default function AdminMobileMenu({ open, email, items, section, onClose, onSelect }: { open: boolean; email: string; items: AdminNavItem[]; section: AdminSection; onClose: () => void; onSelect: (section: AdminSection) => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Закрыть меню" className="absolute inset-0 bg-black/70" onClick={onClose} /><aside className="relative h-full w-[min(88vw,360px)] overflow-y-auto border-r border-white/10 bg-slate-950 p-4 shadow-2xl"><div className="mb-4 flex items-center justify-between"><strong>Админка</strong><button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2">✕</button></div><p className="mb-4 break-all text-xs text-slate-500">{email}</p><nav className="space-y-1">{items.filter((item) => item.visible).map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold ${section === item.id ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{item.label}</button>)}</nav></aside></div>;
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Кейсы", href: "/#cases" },
  { label: "Профиль", href: "/account" },
];

type Role = "USER" | "TESTER" | "ADMIN" | "DEV" | "NPN1_DEV";
type Notification = { id: string; type: string; title: string; body: string; readAt: string | null; createdAt: string };

function roleBadge(role: Role | null) {
  if (role === "NPN1_DEV") return "ZEON NPN 1 DEV";
  if (role === "DEV") return "ZEON DEV";
  if (role === "ADMIN") return "ZEON ADMIN";
  if (role === "TESTER") return "ZEON TESTER";
  return role ? "ZEON USER" : null;
}

export default function Header() {
  const { data: session } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    const loadBalance = async () => {
      if (!session) {
        setBalance(null);
        setRole(null);
        setNotifications([]);
        return;
      }
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setBalance(data.user.balance);
        setRole(data.user.role);
      }
    };

    void loadBalance();
    window.addEventListener("zeon-profile-updated", loadBalance);
    return () => window.removeEventListener("zeon-profile-updated", loadBalance);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const loadNotifications = async () => {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications ?? []);
      }
    };
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 15000);
    return () => window.clearInterval(timer);
  }, [session]);

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const markNotificationsRead = async () => {
    if (!unreadCount) return;
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
  };
  const clearNotifications = async () => {
    const response = await fetch("/api/notifications", { method: "DELETE" });
    if (response.ok) setNotifications([]);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b11]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-black tracking-[-0.08em] text-[#f4f1ff]">ZEON</span>
          <span className="text-[0.62rem] font-black tracking-[0.34em] text-violet-300/90">GGSTORE</span>
        </Link>

        <nav className="hidden items-center gap-7 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-300 md:flex">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className="transition hover:text-violet-200">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-xl border border-violet-500/30 bg-[#111827]/80 px-3 py-2 text-[0.7rem] font-semibold text-slate-100 shadow-[0_0_18px_rgba(168,85,247,0.2)] sm:flex">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/20 text-[0.6rem] font-black text-violet-200">Z</span>
            <span>{balance === null ? "—" : `${new Intl.NumberFormat("ru-RU").format(balance)} Z`}</span>
          </div>

          {session ? (
            <div className="flex items-center gap-3">
              {roleBadge(role) && <span className="hidden text-[0.58rem] font-black uppercase tracking-[0.14em] text-violet-200 lg:inline">{roleBadge(role)}</span>}
              <div className="relative">
                <button type="button" onClick={() => { setNotificationOpen((open) => !open); setMenuOpen(false); void markNotificationsRead(); }} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-violet-300/50 hover:text-white" aria-label="Открыть уведомления">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.58rem] font-black text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                </button>
                {notificationOpen && <div className="absolute right-0 top-12 z-50 w-[min(88vw,360px)] rounded-2xl border border-violet-300/20 bg-[#0a0f18]/95 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-black text-white">Уведомления</p><button type="button" onClick={() => setNotificationOpen(false)} className="text-xs text-slate-500 hover:text-white">Закрыть</button></div>{notifications.length ? <div className="max-h-80 space-y-2 overflow-y-auto">{notifications.map((item) => <article key={item.id} className={`rounded-xl border p-3 ${item.readAt ? "border-white/10 bg-white/[0.02]" : "border-violet-300/30 bg-violet-400/10"}`}><p className="text-sm font-bold text-white">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-300">{item.body}</p><p className="mt-2 text-[0.65rem] text-slate-500">{new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</p></article>)}</div> : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">Новых уведомлений нет.</p>}<div className="mt-3 flex justify-end border-t border-white/10 pt-3"><button type="button" onClick={() => void clearNotifications()} className="text-xs font-bold text-violet-200 transition hover:text-white">Очистить ящик</button></div></div>}
              </div>
              <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-violet-400/50 bg-gradient-to-br from-violet-500/30 to-slate-900/90 shadow-[0_0_22px_rgba(168,85,247,0.35)] transition hover:scale-[1.03]"
                aria-label="Открыть профиль"
              >
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt="Аватар"
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-violet-100">
                    {(session.user?.name || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
              {menuOpen && <div className="absolute right-0 top-14 z-50 w-56 rounded-2xl border border-violet-300/20 bg-[#0a0f18]/95 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                {[['Профиль', '/account'], ['Инвентарь', '/account/inventory'], ['История транзакций', '/account/operations'], ['Настройки', '/account/settings']].map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-violet-400/10">{label}</Link>)}
                {role !== "USER" && <Link href="/admin" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-bold text-violet-200 hover:bg-violet-400/10">{roleBadge(role)}</Link>}
                <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="mt-1 block w-full rounded-xl border-t border-white/10 px-3 py-2.5 text-left text-sm text-red-200 hover:bg-red-400/10">Выйти</button>
              </div>}
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-red-400/30 hover:text-white sm:inline-flex"
              >
                Выйти
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_0_22px_rgba(168,85,247,0.4)] transition hover:brightness-110"
            >
              Войти
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

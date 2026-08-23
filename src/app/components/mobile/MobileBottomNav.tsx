"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type NavItem = { label: string; href?: string; icon: React.ReactNode };
const iconClass = "h-5 w-5 sm:h-6 sm:w-6";
function IconHome() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9Z" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconInventory() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" strokeLinejoin="round" /><path d="m4 8.5 8 4.5 8-4.5M12 13v7" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconGames() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M8 5V3m8 2V3M8 12h.01M12 12h.01M16 12h.01M9.5 15.5h5" strokeLinecap="round" /></svg>; }
function IconWallet() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}><path d="M5 7h12a3 3 0 0 1 3 3v7H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" strokeLinejoin="round"/><path d="M3 10h14M16 13h2" strokeLinecap="round"/></svg>; }
function IconProfile() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6" strokeLinecap="round"/></svg>; }
function IconPlus() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>; }
function itemClass(active: boolean) { return `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[8px] font-black uppercase tracking-[0.06em] transition ${active ? "bg-violet-400/10 text-violet-100" : "text-slate-500 active:bg-white/[0.05] active:text-white"}`; }

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (pathname === "/beta" || pathname.startsWith("/beta/")) return;
    const loadBalance = async () => {
      if (!session) { setBalance(null); return; }
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setBalance(typeof data.user?.balance === "number" ? data.user.balance : null);
    };
    void loadBalance();
    window.addEventListener("zeon-profile-updated", loadBalance);
    return () => window.removeEventListener("zeon-profile-updated", loadBalance);
  }, [session, pathname]);

  if (pathname === "/beta" || pathname.startsWith("/beta/")) return null;

  const items: NavItem[] = [
    { label: "Главная", href: "/", icon: <IconHome /> },
    { label: "Инвентарь", href: "/account/inventory", icon: <IconInventory /> },
    { label: "Игры", href: "/#cases", icon: <IconGames /> },
    { label: "Пополнить", href: "/account", icon: <IconWallet /> },
    { label: "Профиль", href: "/account", icon: <IconProfile /> },
  ];

  const active = (item: NavItem) => {
    if (item.label === "Главная") return pathname === "/";
    if (item.label === "Инвентарь") return pathname.startsWith("/account/inventory");
    if (item.label === "Игры") return pathname.startsWith("/case");
    if (item.label === "Пополнить") return pathname === "/account" && false;
    return pathname.startsWith("/account") && !pathname.startsWith("/account/inventory");
  };

  return <>
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] h-28 bg-gradient-to-t from-[#05070b] via-[#05070b]/96 to-transparent md:hidden" />
    <nav className="fixed inset-x-2 bottom-[max(0.55rem,env(safe-area-inset-bottom))] z-[80] mx-auto flex h-[70px] max-w-[720px] items-center rounded-[26px] border border-white/10 bg-[#11131c]/95 p-1 shadow-[0_-8px_40px_rgba(0,0,0,0.38)] backdrop-blur-2xl md:hidden" aria-label="Мобильная навигация">
      {items.map((item, index) => index === 2 ? <Link key={item.label} href={item.href!} className="relative -mt-7 flex min-w-[68px] flex-1 flex-col items-center gap-1 text-[9px] font-black uppercase tracking-[0.06em] text-violet-100"><span className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-violet-200/30 bg-gradient-to-b from-violet-300 via-fuchsia-400 to-violet-600 text-white shadow-[0_0_28px_rgba(139,92,246,0.32)]"><IconPlus /></span><span>{item.label}</span></Link> : <Link key={item.label} href={item.href!} className={itemClass(active(item))}>{item.icon}<span>{item.label === "Пополнить" && balance !== null ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(balance)} Z` : item.label}</span></Link>)}
    </nav>
  </>;
}

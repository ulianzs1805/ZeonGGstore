"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type NavItem = { label: string; href?: string; icon: React.ReactNode };
const iconClass = "h-5 w-5 sm:h-6 sm:w-6";
function IconCases() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M8 5V3m8 2V3M8 12h.01M12 12h.01M16 12h.01M9.5 15.5h5" strokeLinecap="round" /></svg>; }
function IconBonus() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}><path d="M20 12v7H4v-7" /><path d="M2.5 8.5h19v3.5h-19zM12 8.5V19M8.7 8.5C6.4 8.5 5 7.5 5 6.2 5 5 5.9 4 7.1 4c1.9 0 3.1 2.3 4.9 4.5M15.3 8.5c2.3 0 3.7-1 3.7-2.3C19 5 18.1 4 16.9 4c-1.9 0-3.1 2.3-4.9 4.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconInventory() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" strokeLinejoin="round" /><path d="m4 8.5 8 4.5 8-4.5M12 13v7" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconMenu() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={iconClass}><path d="M5 7h14M5 12h14M5 17h14" strokeLinecap="round" /></svg>; }
function IconPlus() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>; }
function itemClass(active: boolean) { return `flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-2 text-[9px] font-black uppercase tracking-[0.08em] transition ${active ? "bg-violet-400/10 text-violet-100" : "text-slate-500 active:bg-white/[0.05] active:text-white"}`; }

function detectMobileDevice() {
  if (typeof window === "undefined") return false;
  const viewportMobile = window.matchMedia("(max-width: 767px)").matches;
  const touchDevice = navigator.maxTouchPoints > 0;
  const compactTouchDevice = touchDevice && Math.min(window.innerWidth, window.screen.width) <= 1024;
  return viewportMobile || compactTouchDevice;
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const updateDevice = () => setIsMobileDevice(detectMobileDevice());
    updateDevice();
    window.addEventListener("resize", updateDevice);
    window.addEventListener("orientationchange", updateDevice);
    return () => {
      window.removeEventListener("resize", updateDevice);
      window.removeEventListener("orientationchange", updateDevice);
    };
  }, []);

  useEffect(() => {
    if (!isMobileDevice || pathname === "/beta" || pathname.startsWith("/beta/")) return;
    const loadBalance = async () => {
      if (!session) { setBalance(null); return; }
      try {
        const response = await fetch("/api/profile", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const data = await response.json();
        setBalance(typeof data.user?.balance === "number" ? data.user.balance : null);
      } catch {
        // Keep the last known balance if the network is temporarily unavailable.
      }
    };
    void loadBalance();
    window.addEventListener("zeon-profile-updated", loadBalance);
    return () => window.removeEventListener("zeon-profile-updated", loadBalance);
  }, [isMobileDevice, session, pathname]);

  if (!isMobileDevice || pathname === "/beta" || pathname.startsWith("/beta/")) return null;

  const items: NavItem[] = [
    { label: "Кейсы", href: "/#cases", icon: <IconCases /> },
    { label: "Бонусы", href: "/bonuses", icon: <IconBonus /> },
    { label: "Инвентарь", href: "/account/inventory", icon: <IconInventory /> },
  ];

  return <>
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] h-28 bg-gradient-to-t from-[#05070b] via-[#05070b]/96 to-transparent" />
    <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[80] mx-auto flex h-[72px] max-w-[720px] items-center rounded-[28px] border border-white/10 bg-[#11131c]/95 p-1.5 shadow-[0_-8px_40px_rgba(0,0,0,0.38)] backdrop-blur-2xl" aria-label="Мобильная навигация">
      <Link href={items[0].href!} className={itemClass(pathname === "/" || pathname.startsWith("/case"))}>{items[0].icon}<span>{items[0].label}</span></Link>
      <Link href={items[1].href!} className={itemClass(pathname === "/bonuses" || pathname.startsWith("/bonuses/"))}>{items[1].icon}<span>{items[1].label}</span></Link>
      <Link href="/account" className="relative -mt-7 flex min-w-[86px] flex-1 flex-col items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-200"><span className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-emerald-200/30 bg-gradient-to-b from-emerald-300 to-emerald-500 text-[#06241f] shadow-[0_0_28px_rgba(74,222,128,0.28)]"><IconPlus /></span><span>{balance === null ? "Z" : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(balance)} Z`}</span></Link>
      <Link href={items[2].href!} className={itemClass(pathname.startsWith("/account/inventory"))}>{items[2].icon}<span>{items[2].label}</span></Link>
      <button type="button" onClick={() => setMenuOpen(true)} className={itemClass(menuOpen)} aria-label="Открыть мобильное меню"><IconMenu /><span>Меню</span></button>
    </nav>
    {menuOpen && <div className="fixed inset-0 z-[90] flex items-end bg-black/55 p-3 backdrop-blur-sm" onClick={() => setMenuOpen(false)}><div className="w-full rounded-[30px] border border-white/10 bg-[#10131c] p-4 shadow-[0_-24px_70px_rgba(0,0,0,0.55)]" onClick={(event) => event.stopPropagation()}><div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" /><div className="grid grid-cols-2 gap-2">{[["Профиль", "/account"], ["Кейсы", "/#cases"], ["Инвентарь", "/account/inventory"], ["Операции", "/account/operations"], ["Настройки", "/account/settings"]].map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-center text-sm font-black text-slate-100 transition active:scale-[0.98] active:bg-violet-400/10">{label}</Link>)}</div>{!session && <Link href="/" onClick={() => setMenuOpen(false)} className="mt-2 block rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-4 text-center text-sm font-black text-white">Войти через Google</Link>}<button type="button" onClick={() => setMenuOpen(false)} className="mt-2 w-full rounded-2xl border border-white/8 px-4 py-3 text-sm font-bold text-slate-400">Закрыть</button></div></div>}
  </>;
}

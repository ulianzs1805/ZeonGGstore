"use client";

import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";
import WelcomeGiftModal from "@/app/components/WelcomeGiftModal";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type HomeCase = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  glow: string;
  ring: string;
};

const caseVisuals = [
  { glow: "from-rose-500/25 via-red-500/10 to-transparent", ring: "border-rose-400/35" },
  { glow: "from-amber-400/25 via-yellow-400/10 to-transparent", ring: "border-amber-300/35" },
  { glow: "from-emerald-400/25 via-green-400/10 to-transparent", ring: "border-emerald-300/35" },
  { glow: "from-violet-500/30 via-blue-500/10 to-transparent", ring: "border-violet-300/35" },
];

const benefits = ["Честные шансы", "Моментальные дропы", "Безопасный аккаунт", "Бонусы каждый день", "Для своих игроков"];

export default function Home() {
  const [cases, setCases] = useState<HomeCase[]>([]);
  const [casesError, setCasesError] = useState("");

  useEffect(() => {
    const loadCases = async () => {
      try {
        const response = await fetch("/api/cases", { cache: "no-store", credentials: "include" });
        const body = await response.text();
        let data: { cases?: Array<{ id: string; slug: string; name: string; price: number; image: string }>; error?: string } = {};
        try { data = body ? JSON.parse(body) : {}; } catch { throw new Error("API вернул некорректный ответ."); }
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить кейсы.");
        setCases((data.cases ?? []).map((item, index) => ({ ...item, ...caseVisuals[index % caseVisuals.length] })));
      } catch (error) {
        setCasesError(error instanceof Error ? error.message : "Не удалось загрузить кейсы.");
      }
    };
    void loadCases();
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#060812] text-white">
      <WelcomeGiftModal />
      <Header />

      <section className="px-3 pb-8 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[30px] border border-violet-400/20 bg-[#090d18] shadow-[0_24px_100px_rgba(0,0,0,0.52),0_0_70px_rgba(124,58,237,0.10)]">
          <div className="border-b border-violet-300/[0.08] px-4 py-4 sm:px-6 lg:px-8"><RecentDropsStrip title="Последние дропы" /></div>

          <div className="relative isolate min-h-[700px] overflow-hidden bg-[radial-gradient(circle_at_12%_18%,rgba(124,58,237,0.20),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(255,132,43,0.16),transparent_28%),radial-gradient(circle_at_82%_70%,rgba(139,92,246,0.18),transparent_34%),linear-gradient(90deg,#090d18_0%,#090d18_48%,rgba(9,13,24,0.45)_100%)] sm:min-h-[650px] lg:min-h-[620px]">
            {/* Hero deliberately contains no logo image: the existing logo remains exclusively in Header. */}
            <div className="pointer-events-none absolute -right-[34%] top-[-7%] h-[118%] w-[118%] sm:-right-[12%] sm:w-[82%] lg:-right-[6%] lg:w-[68%]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.20),transparent_58%),radial-gradient(ellipse_at_78%_42%,rgba(255,132,43,0.20),transparent_42%)]" />
              <div className="absolute right-[12%] top-[12%] h-[72%] w-[58%] rounded-[50%] border border-violet-300/[0.08] rotate-[-12deg]" />
              <div className="absolute right-[3%] top-[20%] h-[62%] w-[42%] rounded-[50%] border border-orange-300/[0.07] rotate-[14deg]" />
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[58%] bg-[radial-gradient(circle_at_60%_38%,rgba(124,58,237,0.22),transparent_48%),radial-gradient(circle_at_84%_28%,rgba(255,132,43,0.18),transparent_36%)] blur-2xl" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#090d18_0%,#090d18_36%,rgba(9,13,24,0.92)_52%,rgba(9,13,24,0.36)_74%,rgba(9,13,24,0.12)_100%)]" />
            <div className="pointer-events-none absolute -left-24 top-8 h-[380px] w-[380px] rounded-full border border-violet-400/10" />
            <div className="pointer-events-none absolute -right-20 top-[-120px] h-[460px] w-[460px] rounded-full border border-orange-400/10" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/55 to-orange-300/55" />

            <div className="relative z-10 flex min-h-[700px] flex-col justify-between px-5 py-10 sm:min-h-[650px] sm:px-8 sm:py-12 lg:min-h-[620px] lg:px-12 lg:py-14">
              <div className="max-w-2xl">
                <div className="mb-7 flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_20px_rgba(167,139,250,0.95)]" /><span className="text-[0.68rem] font-black uppercase tracking-[0.34em] text-violet-200/90">ZEONGG STORE · BETA</span></div>
                <h1 className="max-w-[820px] text-[2.9rem] font-black leading-[0.9] tracking-[-0.06em] text-white sm:text-6xl lg:text-[4.7rem]"><span className="whitespace-nowrap bg-gradient-to-r from-violet-300 via-white to-orange-300 bg-clip-text text-transparent">ZeonGGstore—</span><br />дроп всегда<br />с тобой.</h1>
                <p className="mt-7 max-w-xl text-[1.05rem] leading-8 text-slate-300 sm:text-lg">Открывай кейсы, забирай топовые скины и поднимайся выше. Здесь удача всегда рядом, а хороший дроп — ещё ближе.</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={cases[0] ? `/case?caseId=${encodeURIComponent(cases[0].slug)}` : "/case"} className="group inline-flex min-w-[220px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-orange-500 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_16px_48px_rgba(124,58,237,0.34),0_0_30px_rgba(255,132,43,0.10)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110">Открыть кейсы <span className="transition-transform duration-300 group-hover:translate-x-1">→</span></Link>
                  <Link href="#cases" className="inline-flex min-w-[185px] items-center justify-center rounded-2xl border border-white/10 bg-[#0a0f1b]/55 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-200 backdrop-blur-md transition hover:border-orange-300/35 hover:bg-orange-400/[0.06] hover:text-white">Смотреть дроп</Link>
                </div>
              </div>
              <div className="mt-8 flex justify-center lg:justify-start"><div className="inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-[#0a0f1b]/80 px-5 py-3 backdrop-blur-xl"><span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-violet-400 to-orange-400 shadow-[0_0_16px_rgba(167,139,250,0.95)]" /><span className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-slate-200">Дроп в реальном времени</span></div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="cases" className="px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-violet-300/75">Выбор игроков</p><h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] text-white">Популярные кейсы</h2></div><Link href="/case" className="text-sm font-bold text-violet-200 transition hover:text-orange-200">Все кейсы →</Link></div>
          {casesError && <p className="mb-6 rounded-xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-200">{casesError}</p>}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{cases.map((item) => <article key={item.id} className="group relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a0f18] p-4 transition duration-300 hover:-translate-y-1 hover:border-violet-300/25"><div className={`absolute inset-0 bg-gradient-to-br ${item.glow} opacity-70`} /><div className="relative"><div className={`relative h-56 overflow-hidden rounded-[22px] border ${item.ring} bg-[#080c15]`}><Image src={item.image} alt={item.name} fill sizes="(max-width: 1280px) 50vw, 25vw" className="object-contain p-5 transition duration-500 group-hover:scale-105" /></div><div className="flex items-center justify-between gap-3 px-1 pb-1 pt-4"><p className="truncate text-base font-black text-white">{item.name}</p><span className="shrink-0 text-sm font-black text-amber-200">{item.price} Z</span></div><Link href={`/case?caseId=${item.id}`} className="mt-4 flex items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/[0.08] py-3 text-xs font-black uppercase tracking-[0.14em] text-violet-100 transition hover:bg-violet-500/20">Открыть</Link></div></article>)}</div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-[1440px] gap-3 md:grid-cols-5">{benefits.map((title, index) => <div key={title} className="rounded-2xl border border-white/[0.08] bg-[#0a0f18] p-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${index % 2 ? "bg-orange-400/10 text-orange-200" : "bg-violet-400/10 text-violet-200"}`}>✦</span><span className="text-sm font-bold text-slate-200">{title}</span></div></div>)}</div></section>
    </main>
  );
}

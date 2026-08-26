"use client";

import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";
import WelcomeGiftModal from "@/app/components/WelcomeGiftModal";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type HomeCase = { id: string; slug: string; name: string; price: number; image: string; glow: string; ring: string };

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

  const heroCases = useMemo(() => cases.slice(0, 4), [cases]);
  const featured = heroCases[1] ?? heroCases[0];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#060812] text-white">
      <WelcomeGiftModal />
      <Header />

      <section className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[32px] border border-white/10 bg-[#090d18] shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/[0.07] px-4 py-4 sm:px-6 lg:px-8">
            <RecentDropsStrip title="Последние дропы" />
          </div>

          <div className="relative isolate overflow-hidden px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(124,58,237,0.18),transparent_30%),radial-gradient(circle_at_78%_35%,rgba(34,211,238,0.10),transparent_34%),linear-gradient(135deg,rgba(124,58,237,0.05),transparent_55%)]" />
            <div className="pointer-events-none absolute left-[52%] top-[-180px] h-[560px] w-[560px] rounded-full border border-violet-400/10 bg-violet-500/[0.04] blur-[1px]" />
            <div className="pointer-events-none absolute left-[58%] top-[-90px] h-[380px] w-[380px] rounded-full border border-fuchsia-300/[0.06]" />

            <div className="relative grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="max-w-xl">
                <div className="mb-6 flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.9)]" />
                  <span className="text-[0.68rem] font-black uppercase tracking-[0.34em] text-violet-200/80">ZEONGG STORE · BETA</span>
                </div>

                <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-[-0.065em] text-white sm:text-6xl xl:text-[5.6rem]">
                  Открывай.<br />
                  <span className="bg-gradient-to-r from-violet-200 via-white to-fuchsia-200 bg-clip-text text-transparent">Рискуй.</span><br />
                  Забирай дроп.
                </h1>

                <p className="mt-7 max-w-lg text-[1.05rem] leading-8 text-slate-300 sm:text-lg">
                  Кейсы, апгрейды и редкие скины в одном месте. Выбирай, открывай и собирай свой лучший инвентарь.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={cases[0] ? `/case?caseId=${encodeURIComponent(cases[0].slug)}` : "/case"} className="group inline-flex min-w-[220px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_42px_rgba(139,92,246,0.32)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110">
                    Открыть кейсы <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </Link>
                  <Link href="#cases" className="inline-flex min-w-[170px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-200 transition hover:border-violet-300/40 hover:bg-violet-400/[0.06] hover:text-white">
                    Смотреть дроп
                  </Link>
                </div>

                <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
                  {[['01','Кейсы'],['02','Апгрейд'],['03','Бонусы']].map(([number, label]) => (
                    <div key={number} className="rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-4">
                      <div className="text-xs font-black tracking-[0.2em] text-violet-300">{number}</div>
                      <div className="mt-2 text-sm font-bold text-slate-200">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mx-auto flex min-h-[500px] w-full max-w-[700px] items-center justify-center sm:min-h-[560px]">
                <div className="absolute inset-x-10 top-1/2 h-[70%] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.20),rgba(6,8,18,0)_68%)] blur-2xl" />
                <div className="absolute h-[390px] w-[390px] rounded-full border border-violet-400/15 sm:h-[460px] sm:w-[460px]" />
                <div className="absolute h-[330px] w-[330px] rounded-full border border-dashed border-violet-300/15 sm:h-[400px] sm:w-[400px]" />

                {heroCases.map((item, index) => {
                  if (item.id === featured?.id) return null;
                  const spots = [
                    "left-0 top-[12%] rotate-[-12deg] sm:left-[2%]",
                    "right-0 top-[10%] rotate-[12deg] sm:right-[2%]",
                    "right-[7%] bottom-[7%] rotate-[6deg] sm:right-[9%]",
                  ];
                  return (
                    <div key={item.id} className={`absolute z-10 hidden w-[180px] sm:block ${spots[index % spots.length]}`}>
                      <div className={`relative aspect-[1.18] overflow-hidden rounded-[26px] border ${item.ring} bg-[#0a0f1b]/90 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)]`}>
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.glow}`} />
                        <Image src={item.image} alt={item.name} fill sizes="180px" className="relative z-10 object-contain p-3" />
                      </div>
                    </div>
                  );
                })}

                {featured ? (
                  <Link href={`/case?caseId=${encodeURIComponent(featured.slug)}`} className="group relative z-20 block w-[82%] max-w-[360px] transition duration-500 hover:scale-[1.03]">
                    <div className="absolute -inset-5 rounded-[40px] bg-gradient-to-r from-violet-600/35 via-fuchsia-500/20 to-cyan-400/20 blur-2xl transition duration-500 group-hover:blur-[44px]" />
                    <div className={`relative aspect-[1.03] overflow-hidden rounded-[34px] border ${featured.ring} bg-[#0a0f1b] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.5)]`}>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.10),transparent_46%)]" />
                      <div className={`absolute inset-0 bg-gradient-to-br ${featured.glow}`} />
                      <div className="absolute inset-3 rounded-[26px] border border-white/[0.08]" />
                      <Image src={featured.image} alt={featured.name} fill priority sizes="360px" className="relative z-10 object-contain p-8 drop-shadow-[0_24px_32px_rgba(0,0,0,0.55)]" />
                      <div className="absolute bottom-5 left-5 right-5 z-20 flex items-end justify-between rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3 backdrop-blur-md">
                        <div className="min-w-0"><div className="text-[0.6rem] font-black uppercase tracking-[0.22em] text-violet-200/70">Featured case</div><div className="mt-1 truncate text-sm font-black text-white">{featured.name}</div></div>
                        <div className="ml-3 shrink-0 text-sm font-black text-amber-200">{featured.price} Z</div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="relative z-20 flex aspect-square w-[72%] max-w-[340px] items-center justify-center rounded-[34px] border border-violet-300/15 bg-[#0a0f1b]/80 text-sm font-bold text-slate-400">Загружаем кейсы…</div>
                )}

                <div className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/[0.08] bg-[#0a0f1b]/85 px-5 py-2.5 backdrop-blur-xl">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
                  <span className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-slate-300">Дроп в реальном времени</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="cases" className="px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-violet-300/75">Выбор игроков</p><h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] text-white">Популярные кейсы</h2></div><Link href="/case" className="text-sm font-bold text-violet-200 transition hover:text-white">Все кейсы →</Link></div>
          {casesError && <p className="mb-6 rounded-xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-200">{casesError}</p>}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {cases.map((item) => <article key={item.id} className="group relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a0f18] p-4 transition duration-300 hover:-translate-y-1 hover:border-violet-300/25"><div className={`absolute inset-0 bg-gradient-to-br ${item.glow} opacity-70`} /><div className="relative"><div className={`relative h-56 overflow-hidden rounded-[22px] border ${item.ring} bg-[#080c15]`}><Image src={item.image} alt={item.name} fill sizes="(max-width: 1280px) 50vw, 25vw" className="object-contain p-5 transition duration-500 group-hover:scale-105" /></div><div className="flex items-center justify-between gap-3 px-1 pb-1 pt-4"><p className="truncate text-base font-black text-white">{item.name}</p><span className="shrink-0 text-sm font-black text-amber-200">{item.price} Z</span></div><Link href={`/case?caseId=${item.id}`} className="mt-4 flex items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/[0.08] py-3 text-xs font-black uppercase tracking-[0.14em] text-violet-100 transition hover:bg-violet-500/20">Открыть</Link></div></article>)}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-[1440px] gap-3 md:grid-cols-5">{benefits.map((title, index) => <div key={title} className="rounded-2xl border border-white/[0.08] bg-[#0a0f18] p-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${index % 2 ? "bg-fuchsia-400/10 text-fuchsia-200" : "bg-violet-400/10 text-violet-200"}`}>✦</span><span className="text-sm font-bold text-slate-200">{title}</span></div></div>)}</div></section>
    </main>
  );
}

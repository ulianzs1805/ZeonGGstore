"use client";

import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";
import Link from "next/link";

function BonusCard({ href, icon, title, description }: { href: string; icon: string; title: string; description: string }) {
  return <Link href={href} className="group rounded-[26px] border border-white/10 bg-[#0a0f18] p-6 transition hover:-translate-y-1 hover:border-violet-300/30 hover:bg-violet-500/[0.05]"><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/10 text-2xl font-black text-violet-200">{icon}</div><h2 className="mt-5 text-xl font-black text-white group-hover:text-violet-200">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p><span className="mt-5 inline-flex text-xs font-black uppercase tracking-[.14em] text-violet-300">Открыть →</span></Link>;
}

export default function BonusesPage() {
  return <main className="min-h-screen bg-[#05070d] text-white"><Header /><section className="px-4 pb-12 pt-6"><div className="mx-auto max-w-[1440px] overflow-hidden rounded-[30px] border border-white/10 bg-[#070b11]"><div className="border-b border-white/10 px-4 py-4"><RecentDropsStrip title="Последние дропы" /></div><div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16"><div className="text-center"><p className="text-xs font-semibold uppercase tracking-[.3em] text-violet-300">ZEONGGSTORE • БОНУСЫ</p><h1 className="mt-3 text-4xl font-black uppercase sm:text-5xl">Бонусы</h1><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400">Выбери, какой бонус открыть. Каждый раздел работает отдельно — барабан и промокоды не смешиваются в одной странице.</p></div><div className="mt-10 grid gap-5 sm:grid-cols-2"><BonusCard href="/bonuses/wheel" icon="◉" title="Барабан" description="Колесо фортуны с 8 уникальными бонусами, Zeon Secret и случайным скином за пополнение." /><BonusCard href="/bonuses/promocodes" icon="%" title="Промокоды" description="Активируй промокоды и получай доступные бонусы от Zeon." /></div></div></div></section></main>;
}

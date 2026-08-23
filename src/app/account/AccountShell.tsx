"use client";

import SidebarNav from "./SidebarNav";
import type { AccountSection } from "./account-types";

export function StateMessage({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[18px] border border-dashed border-white/10 bg-[#0d131b]/70 p-6 text-center text-sm text-slate-300">{children}</div>;
}

export default function AccountShell({ active, title, children }: { active: AccountSection; title: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#04070d] text-white"><div className="mx-auto max-w-[1460px] px-4 pb-12 pt-5 sm:px-6 lg:px-8"><div className="overflow-hidden rounded-[26px] border border-violet-500/10 bg-[#060b13] shadow-[0_0_50px_rgba(153,92,255,0.14)]"><div className="flex min-h-[620px] flex-col bg-[#060b13] lg:flex-row"><aside className="w-full border-b border-white/10 bg-[#060b13] p-5 lg:w-[260px] lg:border-b-0 lg:border-r"><div className="mb-6 flex items-center gap-2"><span className="text-[1.7rem] font-black tracking-[-0.12em] text-[#f6f1ff]">ZEON</span><span className="text-[0.52rem] font-black tracking-[0.42em] text-violet-300/90">GGSTORE</span></div><SidebarNav active={active} /></aside><section className="flex-1 bg-[#070d16]"><div className="border-b border-white/10 bg-[#070d16]/70 px-5 py-5 sm:px-6 lg:px-7"><h1 className="text-2xl font-black tracking-[-0.06em] text-white">{title}</h1></div><div className="p-5 sm:p-6 lg:p-7">{children}</div></section></div></div></div></main>;
}

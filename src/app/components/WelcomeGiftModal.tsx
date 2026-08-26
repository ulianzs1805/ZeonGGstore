"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type WelcomeCase = { id: string; slug: string; name: string; image: string; price: number };

export default function WelcomeGiftModal() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [giftCase, setGiftCase] = useState<WelcomeCase | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("zeon-welcome-seen") === "1") return;
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!session || !open || giftCase || loading) return;
    setLoading(true);
    fetch("/api/welcome-case", { cache: "no-store", credentials: "include" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => setGiftCase(data?.case ?? null))
      .finally(() => setLoading(false));
  }, [session, open, giftCase, loading]);

  const close = () => {
    sessionStorage.setItem("zeon-welcome-seen", "1");
    setOpen(false);
  };

  if (!open || status === "loading") return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#02040a]/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[32px] border border-violet-300/30 bg-[#080d18] p-6 shadow-[0_0_90px_rgba(124,58,237,0.4)] sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.25),transparent_48%)]" />
        <button type="button" onClick={close} className="absolute right-4 top-4 z-10 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400 hover:text-white">Позже</button>
        <div className="relative text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-300/30 bg-orange-400/10 text-3xl shadow-[0_0_28px_rgba(249,115,22,0.22)]">🎁</div>
          <p className="text-[0.7rem] font-black uppercase tracking-[0.3em] text-violet-300">Подарок новичку</p>
          <h2 className="mt-3 text-3xl font-black uppercase tracking-[-0.05em] text-white">Добро пожаловать в ZeonGGStore</h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-300">Спасибо, что выбрали именно нас. Для новых игроков мы приготовили бесплатный приветственный кейс.</p>

          {!session ? (
            <button type="button" onClick={() => signIn("google", { callbackUrl: "/" })} className="mt-7 w-full rounded-2xl border border-violet-300/40 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_0_28px_rgba(168,85,247,0.38)]">Войти через Google и получить подарок</button>
          ) : loading ? (
            <div className="mt-7 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">Выбираем твой случайный приветственный кейс…</div>
          ) : giftCase ? (
            <div className="mt-7 rounded-[24px] border border-violet-300/25 bg-[#0d1320] p-4">
              <div className="relative mx-auto h-40 w-full max-w-[300px]">
                <Image src={giftCase.image} alt={giftCase.name} fill className="object-contain" priority />
              </div>
              <p className="mt-2 text-lg font-black text-white">{giftCase.name}</p>
              <p className="mt-1 text-xs text-violet-200">Твой случайный бесплатный кейс уже закреплён за аккаунтом</p>
              <Link href={`/case?caseId=${encodeURIComponent(giftCase.slug)}`} onClick={close} className="mt-5 block w-full rounded-2xl border border-orange-300/35 bg-gradient-to-r from-orange-500 to-violet-600 px-5 py-3.5 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_0_24px_rgba(249,115,22,0.25)]">Открыть бесплатно</Link>
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">Приветственный подарок уже был получен для этого аккаунта.</div>
          )}
        </div>
      </div>
    </div>
  );
}

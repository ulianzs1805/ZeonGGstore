"use client";

import { FormEvent, useState } from "react";
import Header from "@/app/components/Header";
import RecentDropsStrip from "@/app/components/RecentDropsStrip";

function QuestionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9.5 9a2.8 2.8 0 1 1 4.8 2c-.9.9-2.3 1.5-2.3 3.1" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" strokeWidth="3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export default function BonusesPage() {
  const [promo, setPromo] = useState("");
  const [notice, setNotice] = useState("");
  const [promoInfoOpen, setPromoInfoOpen] = useState(false);

  const submitPromo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = promo.trim();
    setNotice(value ? "Промокод отправлен на проверку. Система активации будет подключена отдельно." : "Сначала введи промокод.");
  };

  return (
    <main className="min-h-screen bg-[#05070d] text-white">
      <Header />

      <section className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[30px] border border-white/10 bg-[#070b11]/90 shadow-[0_0_36px_rgba(76,29,149,0.25)]">
          <div className="border-b border-white/10 px-4 py-4 sm:px-6 lg:px-8">
            <RecentDropsStrip title="Последние дропы" />
          </div>

          <div className="relative overflow-hidden px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(168,85,247,0.18),_rgba(2,6,23,0)_48%)]" />
            <div className="absolute left-[-8%] top-8 h-72 w-72 rounded-full bg-violet-500/10 blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-5%] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-[130px]" />

            <div className="relative mx-auto max-w-2xl">
              <div className="mb-8 text-center">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-violet-300/90">ZEONGGSTORE</p>
                <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] sm:text-5xl">Бонусы</h1>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">Активируй промокоды и получай дополнительные бонусы на свой аккаунт.</p>
              </div>

              <div className="rounded-[28px] border border-violet-400/20 bg-[#0a0f18]/90 p-5 shadow-[0_0_42px_rgba(168,85,247,0.15)] sm:p-7">
                <form onSubmit={submitPromo}>
                  <div className="mb-3 flex items-center gap-2">
                    <label htmlFor="promo" className="text-lg font-black text-white">Введи промокод</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPromoInfoOpen((open) => !open)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/10 text-violet-200 transition hover:bg-violet-500/20 active:scale-95"
                        aria-label="Что такое промокоды"
                        aria-expanded={promoInfoOpen}
                      >
                        <QuestionIcon />
                      </button>
                      {promoInfoOpen && (
                        <div className="absolute left-0 top-10 z-30 w-[min(82vw,330px)] rounded-xl border border-violet-300/20 bg-[#111827] p-3 text-left text-xs leading-5 text-slate-300 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
                          <p><span className="font-black text-white">Для чего:</span> активируй промокод, чтобы получить бонус на аккаунт.</p>
                          <p className="mt-2"><span className="font-black text-white">Что можно получить:</span> Z, бесплатный кейс или другой подарок.</p>
                          <p className="mt-2"><span className="font-black text-white">Где брать:</span> новые промокоды публикуются в официальных анонсах и сообщениях проекта.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      id="promo"
                      value={promo}
                      onChange={(event) => setPromo(event.target.value)}
                      placeholder="Например: ZEON2026"
                      autoComplete="off"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#060a12] px-4 py-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/15"
                    />
                    <button type="submit" className="rounded-xl border border-violet-400/40 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_0_24px_rgba(168,85,247,0.35)] transition hover:brightness-110">
                      Активировать
                    </button>
                  </div>
                </form>

                {notice && <p className="mt-4 rounded-xl border border-violet-300/15 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">{notice}</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

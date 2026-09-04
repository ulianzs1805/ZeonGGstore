"use client";

import Link from "next/link";
import { useState } from "react";

const faq = [
  ["Что такое Z-Coin?", "Z-Coin — внутренняя валюта ZeonGGStore, которая используется для кейсов, апгрейда и других игровых функций сайта."],
  ["Как получить бонус на депозит?", "Бонус можно получить через барабан бонусов. Выигранный персональный промокод сохраняется в аккаунте и имеет ограниченный срок действия."],
  ["Где найти мой промокод?", "Полученные персональные промокоды доступны в разделе бонусов и привязаны к вашему аккаунту."],
  ["Почему барабан недоступен?", "Обычный повторный запуск барабана доступен через 24 часа. Для специальных кодов обхода действуют отдельные ограничения."],
  ["Что делать, если возникла проблема?", "Обратитесь в поддержку через личный кабинет. Контактную почту мы добавим сюда, когда вы её пришлёте."],
];

export default function SiteFooter() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <footer className="mt-16 border-t border-white/[0.08] bg-[#070a12] text-slate-300">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.8fr_0.8fr_1.35fr]">
          <div>
            <div className="text-2xl font-black tracking-tight text-white">
              Zeon<span className="text-violet-300">GG</span>Store
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
              Закрытая beta-платформа с кейсами, дропами, апгрейдом и бонусами для Standoff 2.
            </p>
            <div className="mt-6 inline-flex rounded-full border border-violet-400/20 bg-violet-400/[0.06] px-3 py-1.5 text-xs font-bold text-violet-200">
              ZEON • CLOSED BETA
            </div>
            <div className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              © {new Date().getFullYear()} ZeonGGStore
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">Навигация</h2>
            <nav className="mt-5 flex flex-col gap-3 text-sm">
              <Link href="/" className="transition hover:text-white">Главная</Link>
              <Link href="/bonuses" className="transition hover:text-white">Бонусы</Link>
              <Link href="/upgrade" className="transition hover:text-white">Апгрейд</Link>
              <Link href="/games" className="transition hover:text-white">Игры</Link>
              <Link href="/account" className="transition hover:text-white">Личный кабинет</Link>
            </nav>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">Информация</h2>
            <nav className="mt-5 flex flex-col gap-3 text-sm">
              <Link href="/agreement" className="transition hover:text-white">Пользовательское соглашение</Link>
              <Link href="/agreement#refund" className="transition hover:text-white">Правила возврата</Link>
              <Link href="/account/support" className="transition hover:text-white">Поддержка</Link>
              <span className="pt-2 text-xs leading-5 text-slate-500">
                Почта для связи — будет добавлена после получения адреса.
              </span>
            </nav>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">F.A.Q</h2>
            <div className="mt-4 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4">
              {faq.map(([question, answer], index) => (
                <div key={question}>
                  <button
                    type="button"
                    onClick={() => setOpen(open === index ? null : index)}
                    className="flex w-full items-center justify-between gap-4 py-3.5 text-left text-sm font-bold text-slate-200"
                  >
                    <span>{question}</span>
                    <span className="shrink-0 text-lg text-violet-300">{open === index ? "−" : "+"}</span>
                  </button>
                  {open === index && (
                    <p className="pb-4 text-sm leading-6 text-slate-400">{answer}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.07] pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Все игровые функции и внутренняя валюта ZeonGGStore предназначены для использования внутри платформы.</span>
          <span>Почта поддержки: будет добавлена</span>
        </div>
      </div>
    </footer>
  );
}

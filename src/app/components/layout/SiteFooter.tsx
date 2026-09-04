"use client";

import Link from "next/link";
import { useState } from "react";

const faq = [
  ["Что такое Z-Coin?", "Z-Coin — внутренняя валюта ZeonGGStore, которая используется для кейсов и игровых функций сайта."],
  ["Как получить бонус на депозит?", "Бонус можно получить через барабан бонусов. После выигрыша промокод сохраняется в вашем аккаунте и действует ограниченное время."],
  ["Где найти мой промокод?", "Полученные промокоды доступны в разделе бонусов и привязаны к вашему аккаунту."],
  ["Почему барабан недоступен?", "Обычный повторный запуск барабана доступен через 24 часа. Для специальных кодов обхода действуют отдельные ограничения."],
  ["Что делать, если возникла проблема?", "Напишите в поддержку по адресу, который будет указан в разделе контактов."],
];

export default function SiteFooter() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <footer className="mt-16 border-t border-white/[0.08] bg-[#070a12] text-slate-300">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr_0.7fr]">
          <div>
            <div className="text-xl font-black tracking-tight text-white">Zeon<span className="text-violet-300">GG</span>Store</div>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">Кейсы, дропы, апгрейд и бонусы. Закрытая beta-платформа ZeonGGStore.</p>
            <div className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">© {new Date().getFullYear()} ZeonGGStore</div>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">FAQ</h2>
            <div className="mt-4 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4">
              {faq.map(([question, answer], index) => (
                <div key={question}>
                  <button type="button" onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-bold text-slate-200">
                    <span>{question}</span><span className="text-lg text-violet-300">{open === index ? "−" : "+"}</span>
                  </button>
                  {open === index && <p className="pb-4 text-sm leading-6 text-slate-400">{answer}</p>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">Информация</h2>
            <nav className="mt-4 flex flex-col gap-3 text-sm">
              <Link href="/agreement" className="transition hover:text-white">Пользовательское соглашение</Link>
              <Link href="/agreement#refund" className="transition hover:text-white">Правила возврата</Link>
              <span className="text-slate-500">Почта для связи — будет добавлена</span>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

export default function UpgradeRecoveryInfo() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname !== "/upgrade") return null;

  return (
    <div className="fixed right-4 top-24 z-[90] sm:right-6 sm:top-28">
      <button
        type="button"
        aria-label="Информация о кейсе отыгрыша"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid h-10 w-10 place-items-center rounded-full border border-violet-300/25 bg-[#111525]/95 text-sm font-black text-violet-200 shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur transition hover:scale-105 hover:border-violet-300/50"
      >
        ?
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(360px,calc(100vw-32px))] rounded-2xl border border-violet-300/20 bg-[#0d1020]/98 p-4 text-left shadow-[0_20px_70px_rgba(0,0,0,.55)] backdrop-blur-xl">
          <p className="text-sm font-black text-white">Кейс отыгрыша</p>
          <div className="mt-3 space-y-2 text-xs leading-5 text-zinc-400">
            <p><b className="text-violet-200">Шанс получить кейс — 50%.</b> После проигрыша апгрейда кейс появляется не всегда.</p>
            <p><b className="text-violet-200">Минимальная компенсация — 25% от потерянной суммы.</b> Например, при потере 2000 Z минимальная стоимость предмета из кейса — 500 Z.</p>
            <p>Поэтому после проигрыша можно получить меньше потерянной суммы, примерно столько же или больше неё.</p>
            <p><b className="text-emerald-300">Можно уйти в плюс.</b> Если стоимость полученного предмета выше потерянной суммы, результат отыгрыша перекрывает потерю.</p>
            <p className="text-zinc-500">Чем сильнее стоимость дропа превышает потерю, тем реже такой исход. Кейс не гарантирует полный возврат или прибыль.</p>
          </div>
        </div>
      )}
    </div>
  );
}

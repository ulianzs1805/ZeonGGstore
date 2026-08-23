"use client";

import { useEffect, useRef, useState } from "react";

type HelpTipProps = {
  text: string;
  label?: string;
};

export default function HelpTip({ text, label = "Подробнее" }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const caseInfoLabel = "Зачем убрана картинка кейса?";
  const resolvedText = text === "Изображение кейса здесь больше не используется — основной акцент страницы сделан на рулетке, шансах и самом открытии."
    ? "Здесь указано название выбранного кейса и количество предметов, которые можно получить из него."
    : text;
  const resolvedLabel = label === caseInfoLabel ? "Информация о кейсе" : label;

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={resolvedLabel}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-[11px] font-black text-slate-300 transition hover:border-yellow-300/60 hover:bg-yellow-300/10 hover:text-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-300/30"
      >
        ?
      </button>
      {open && (
        <span className="absolute left-1/2 top-7 z-[80] w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-[#11151d]/95 p-3 text-left text-xs font-medium leading-5 text-slate-200 shadow-2xl backdrop-blur-xl">
          {resolvedText}
        </span>
      )}
    </span>
  );
}

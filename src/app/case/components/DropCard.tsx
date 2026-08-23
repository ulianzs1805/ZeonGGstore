"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getRarityCardClass } from "@/lib/rarity-styles";
import type { CaseItem } from "../lib/types";

const IMAGE_RETRY_LIMIT = 3;
const IMAGE_RETRY_DELAY = 250;

export default function DropCard({ item, winner = false }: { item: CaseItem; winner?: boolean }) {
  const imageSrc = useMemo(() => (typeof item.image === "string" ? item.image.trim() : ""), [item.image]);
  const [imageError, setImageError] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);

  useEffect(() => {
    setImageError(false);
    setImageAttempt(0);
  }, [imageSrc]);

  useEffect(() => {
    if (!imageSrc || !imageError || imageAttempt >= IMAGE_RETRY_LIMIT) return;
    const timer = window.setTimeout(() => {
      setImageError(false);
      setImageAttempt((attempt) => attempt + 1);
    }, IMAGE_RETRY_DELAY);
    return () => window.clearTimeout(timer);
  }, [imageSrc, imageError, imageAttempt]);

  const retrySrc = imageSrc && imageAttempt > 0
    ? `${imageSrc}${imageSrc.includes("?") ? "&" : "?"}zeon_retry=${imageAttempt}`
    : imageSrc;

  return (
    <div
      className={[
        "relative flex min-w-[180px] flex-col items-center rounded-[22px] border-2 p-4 backdrop-blur-sm transition-transform duration-300",
        getRarityCardClass(item.rarity),
        winner ? "ring-2 ring-yellow-300/80 shadow-[0_0_45px_rgba(250,204,21,0.55)] scale-[1.04] animate-[pulse_900ms_ease-in-out_2]" : "hover:-translate-y-1 hover:scale-[1.02]",
      ].join(" ")}
    >
      {winner && <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-yellow-300/10 blur-xl" />}
      <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[18px]">
        {imageSrc && !imageError ? (
          <Image
            key={`${imageSrc}:${imageAttempt}`}
            src={retrySrc}
            alt={item.name}
            fill
            className="object-contain"
            sizes="112px"
            unoptimized
            loading="eager"
            priority
            draggable={false}
            onError={() => setImageError(true)}
          />
        ) : imageSrc && imageAttempt < IMAGE_RETRY_LIMIT ? (
          <div className="h-full w-full" aria-hidden="true" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-xs font-semibold text-slate-400">
            Изображение недоступно
          </div>
        )}
      </div>
      <h3 className={`mt-3 text-center font-black ${item.color}`}>{item.name}</h3>
      <p className="mt-1 text-[11px] font-medium uppercase text-slate-200/80">{item.rarity}</p>
    </div>
  );
}

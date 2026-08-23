"use client";

import Image from "next/image";
import type { Drop } from "../lib/types";

export default function DropCard({ drop, className = "" }: { drop: Drop; className?: string }) {
  const imageSrc = typeof drop.image === "string" ? drop.image.trim() : "";

  return (
    <article className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 ${className}`}>
      <div className="relative aspect-square w-full">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={drop.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 180px"
            className="object-contain p-3"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-slate-500">Нет изображения</div>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-bold">{drop.name}</p>
        <p className="mt-1 text-xs text-slate-400">{drop.price} Z</p>
      </div>
    </article>
  );
}

"use client";

import { useEffect, useState } from "react";

type Props = { src: string; alt?: string; className?: string };

function removeBackground(source: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return source.src;
  ctx.drawImage(source, 0, 0, size, size);
  const image = ctx.getImageData(0, 0, size, size);
  const { data } = image;
  const points = [0, size - 1, (size - 1) * size, size * size - 1];
  const bg = points.map((p) => [data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]);
  const distance = (p: number, c: number[]) => {
    const r = data[p * 4] - c[0];
    const g = data[p * 4 + 1] - c[1];
    const b = data[p * 4 + 2] - c[2];
    return Math.sqrt(r * r + g * g + b * b);
  };
  for (let p = 0; p < size * size; p++) {
    const a = data[p * 4 + 3];
    if (!a) continue;
    const nearest = Math.min(...bg.map((c) => distance(p, c)));
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lowContrast = max - min < 42;
    if (nearest < 55 || (nearest < 82 && lowContrast)) data[p * 4 + 3] = 0;
    else if (nearest < 105 && lowContrast) data[p * 4 + 3] = Math.round(a * 0.35);
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

export default function TransparentImage({ src, alt = "", className = "" }: Props) {
  const [processed, setProcessed] = useState(src);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const result = removeBackground(img);
        if (!cancelled) setProcessed(result);
      } catch {
        if (!cancelled) setProcessed(src);
      }
    };
    img.onerror = () => { if (!cancelled) setProcessed(src); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return <img src={processed} alt={alt} className={className} draggable={false} />;
}

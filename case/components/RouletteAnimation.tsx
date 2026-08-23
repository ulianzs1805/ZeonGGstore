"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DropCard from "./DropCard";
import type { Drop } from "../lib/types";

const ITEM_WIDTH = 180;
const VISIBLE_ITEMS = 9;

export default function RouletteAnimation({ drops, winner, spinning, onFinish }: { drops: Drop[]; winner: Drop | null; spinning: boolean; onFinish?: () => void }) {
  const [items, setItems] = useState<Drop[]>([]);
  const [offset, setOffset] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build a private animation sequence only when a spin starts. The sequence
  // contains the original Drop objects, so image URLs are never regenerated
  // while the CSS animation is running.
  const sourceDrops = useMemo(() => drops.filter((drop) => typeof drop.image === "string" && drop.image.trim()), [drops]);

  useEffect(() => {
    if (!spinning || !sourceDrops.length) return;

    const target = winner && sourceDrops.some((drop) => drop.id === winner.id) ? winner : sourceDrops[0];
    const sequence: Drop[] = [];
    for (let i = 0; i < 48; i += 1) {
      sequence.push(sourceDrops[i % sourceDrops.length]);
    }
    sequence.push(target);

    setItems(sequence);
    setOffset(0);
    setTransitioning(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitioning(true);
        setOffset(-(sequence.length - Math.ceil(VISIBLE_ITEMS / 2)) * ITEM_WIDTH);
      });
    });

    if (finishTimer.current) clearTimeout(finishTimer.current);
    finishTimer.current = setTimeout(() => onFinish?.(), 2600);

    return () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
    };
  }, [spinning, sourceDrops, winner, onFinish]);

  return (
    <div className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-violet-300/80" />
      <div
        className="flex will-change-transform"
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: transitioning ? "transform 2600ms cubic-bezier(0.12, 0.72, 0.08, 1)" : "none",
        }}
      >
        {items.map((drop, index) => (
          <div key={`${drop.id}-${index}`} className="w-[180px] shrink-0 px-2">
            <DropCard drop={drop} />
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";

type Item = { id: string; name: string; image: string; price: number; rarity?: string };

type Props = {
  caseId: string;
  lostValue: number;
  onClose: () => void;
  onReward?: (item: Item) => void;
};

export default function RecoveryCaseModal({ caseId, lostValue, onClose, onReward }: Props) {
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [reward, setReward] = useState<Item | null>(null);
  const [error, setError] = useState("");

  async function openCase() {
    if (opening || opened) return;
    setOpening(true);
    setError("");
    try {
      const response = await fetch("/api/upgrader/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось открыть кейс");
      setReward(data.reward);
      setOpened(true);
      if (data.reward) onReward?.(data.reward);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка открытия кейса");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-[30px] border border-violet-400/20 bg-[#0d1020] p-6 text-center shadow-[0_30px_120px_rgba(0,0,0,.65)]">
        <p className="text-[10px] font-black tracking-[.35em] text-violet-300">ПОСЛЕ НЕУДАЧНОГО АПГРЕЙДА</p>
        <h2 className="mt-2 text-2xl font-black">Кейс отыгрыша</h2>

        {!opened ? (
          <>
            <div className={`relative mx-auto mt-7 h-60 w-60 transition duration-500 ${opening ? "scale-110 -translate-y-2" : ""}`}>
              <Image
                src="/cases/CaseRecoceryUpgrade.jpeg"
                alt="Кейс отыгрыша"
                fill
                className="object-contain drop-shadow-[0_0_45px_rgba(124,58,237,.5)]"
                unoptimized
              />
              {opening && <div className="absolute inset-1 animate-pulse rounded-full bg-violet-500/15 blur-2xl" />}
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Потеряно: <b className="text-[#f2b84d]">{lostValue.toFixed(2)} Z-Coin</b>
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-zinc-500">
              Награда рассчитывается сервером относительно потерянной стоимости. Полный возврат не гарантируется.
            </p>
            <button
              type="button"
              onClick={() => void openCase()}
              disabled={opening}
              className="mt-6 w-full rounded-2xl bg-[linear-gradient(90deg,#6730df,#9138f5,#ff7f2a)] py-4 font-black tracking-[.14em] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
            >
              {opening ? "ОТКРЫВАЕМ..." : "ОТКРЫТЬ КЕЙС"}
            </button>
          </>
        ) : (
          <>
            <div className="mt-7 rounded-3xl border border-violet-400/15 bg-[#111525] p-6">
              <p className="text-[10px] font-black tracking-[.3em] text-zinc-500">ВАША НАГРАДА</p>
              {reward && (
                <div className="relative mx-auto mt-4 h-40 w-full max-w-xs">
                  <Image src={reward.image} alt={reward.name} fill className="object-contain" unoptimized />
                </div>
              )}
              <p className="mt-3 text-lg font-black">{reward?.name ?? "—"}</p>
              <p className="mt-1 font-black text-[#f2b84d]">{reward ? reward.price.toFixed(2) : "—"} Z</p>
            </div>
            <button type="button" onClick={onClose} className="mt-5 w-full rounded-2xl border border-violet-400/20 bg-[#171a2b] py-4 font-black hover:bg-[#1c2035]">
              ЗАКРЫТЬ
            </button>
          </>
        )}

        {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}

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

type Stage = "closed" | "opening" | "opened";

export default function RecoveryCaseModal({ caseId, lostValue, onClose, onReward }: Props) {
  const [opening, setOpening] = useState(false);
  const [stage, setStage] = useState<Stage>("closed");
  const [reward, setReward] = useState<Item | null>(null);
  const [error, setError] = useState("");

  async function openCase() {
    if (opening || stage !== "closed") return;
    setOpening(true);
    setError("");

    // Сначала визуально открываем сам кейс, затем запрашиваем серверный результат.
    setStage("opening");

    try {
      const response = await fetch("/api/upgrader/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryCaseId: caseId, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось открыть кейс");

      await new Promise((resolve) => setTimeout(resolve, 1250));
      setReward(data.resultItem ?? null);
      setStage("opened");
      if (data.resultItem) onReward?.(data.resultItem);
    } catch (e) {
      setStage("closed");
      setError(e instanceof Error ? e.message : "Ошибка открытия кейса");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg overflow-hidden rounded-[30px] border border-violet-400/20 bg-[#0d1020] p-6 text-center shadow-[0_30px_120px_rgba(0,0,0,.65)]">
        <style>{`
          @keyframes recoveryShake {
            0%, 100% { transform: translateX(0) rotate(0deg); }
            15% { transform: translateX(-5px) rotate(-1deg); }
            30% { transform: translateX(6px) rotate(1deg); }
            45% { transform: translateX(-4px) rotate(-1deg); }
            60% { transform: translateX(5px) rotate(1deg); }
            75% { transform: translateX(-2px); }
          }
          @keyframes recoveryLidFly {
            0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
            45% { transform: translate(18px, -52px) rotate(16deg); opacity: 1; }
            100% { transform: translate(105px, 145px) rotate(128deg); opacity: 0.96; }
          }
          @keyframes recoveryReveal {
            0% { opacity: 0; transform: scale(.92) translateY(12px); filter: brightness(1.9); }
            100% { opacity: 1; transform: scale(1) translateY(0); filter: brightness(1); }
          }
          @keyframes recoveryReward {
            0% { opacity: 0; transform: translateY(18px) scale(.92); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          .recovery-opening { animation: recoveryShake .72s ease-in-out both; }
          .recovery-lid { transform-origin: 50% 100%; }
          .recovery-lid-opening { animation: recoveryLidFly 1.05s cubic-bezier(.22,.8,.22,1) .18s forwards; }
          .recovery-opened { animation: recoveryReveal .45s ease-out both; }
          .recovery-reward { animation: recoveryReward .45s ease-out both; }
        `}</style>

        <p className="text-[10px] font-black tracking-[.35em] text-violet-300">ПОСЛЕ НЕУДАЧНОГО АПГРЕЙДА</p>
        <h2 className="mt-2 text-2xl font-black">Кейс отыгрыша</h2>

        <div className="relative mx-auto mt-7 h-64 w-72">
          {stage !== "opened" && (
            <div className={`absolute inset-0 ${stage === "opening" ? "recovery-opening" : ""}`}>
              <Image
                src="/cases/CaseRecoveryUpgrader.jpeg"
                alt="Кейс отыгрыша"
                fill
                className="object-contain drop-shadow-[0_0_45px_rgba(124,58,237,.5)]"
                unoptimized
                priority
              />
              {stage === "opening" && (
                <div className="recovery-lid recovery-lid-opening pointer-events-none absolute left-[10%] top-[2%] h-[48%] w-[80%] overflow-hidden">
                  <Image
                    src="/cases/CaseRecoveryUpgrader.jpeg"
                    alt="Открывающаяся крышка кейса"
                    fill
                    className="object-cover object-top"
                    unoptimized
                  />
                </div>
              )}
            </div>
          )}

          {stage === "opened" && (
            <div className="recovery-opened absolute inset-0">
              <Image
                src="/cases/OpenedCaseRecovery.jpeg"
                alt="Открытый кейс отыгрыша"
                fill
                className="object-contain drop-shadow-[0_0_55px_rgba(124,58,237,.55)]"
                unoptimized
                priority
              />
            </div>
          )}
        </div>

        {stage !== "opened" ? (
          <>
            <p className="mt-2 text-sm text-zinc-400">Потеряно: <b className="text-[#f2b84d]">{lostValue.toFixed(2)} Z-Coin</b></p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-zinc-500">Награда рассчитывается сервером относительно потерянной стоимости. Полный возврат не гарантируется.</p>
            <button type="button" onClick={() => void openCase()} disabled={opening} className="mt-6 w-full rounded-2xl bg-[linear-gradient(90deg,#6730df,#9138f5,#ff7f2a)] py-4 font-black tracking-[.14em] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50">{opening ? "КРЫШКА ОТКРЫВАЕТСЯ..." : "ОТКРЫТЬ КЕЙС"}</button>
          </>
        ) : (
          <div className="recovery-reward mt-2">
            <div className="rounded-3xl border border-violet-400/15 bg-[#111525] p-6">
              <p className="text-[10px] font-black tracking-[.3em] text-zinc-500">ВАША НАГРАДА</p>
              {reward && <div className="relative mx-auto mt-4 h-40 w-full max-w-xs"><Image src={reward.image} alt={reward.name} fill className="object-contain" unoptimized /></div>}
              <p className="mt-3 text-lg font-black">{reward?.name ?? "—"}</p>
              <p className="mt-1 font-black text-[#f2b84d]">{reward ? reward.price.toFixed(2) : "—"} Z</p>
            </div>
            <button type="button" onClick={onClose} className="mt-5 w-full rounded-2xl border border-violet-400/20 bg-[#171a2b] py-4 font-black hover:bg-[#1c2035]">ЗАКРЫТЬ</button>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}

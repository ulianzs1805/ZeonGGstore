"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getRarityTextClass } from "@/lib/rarity-styles";
import { StateMessage } from "./AccountShell";
import type { InventoryItem } from "./account-types";

function WithdrawalForm({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [avatarDataUrl, setAvatarDataUrl] = useState("");
  const [avatarName, setAvatarName] = useState("");
  const [listingSkinName, setListingSkinName] = useState("");
  const [pattern, setPattern] = useState("");
  const [stickerCount, setStickerCount] = useState(0);
  const [stickers, setStickers] = useState<string[]>([]);
  const [listingPriceGold, setListingPriceGold] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const calculatedListingPrice = useMemo(() => Math.ceil(Math.max(0, Math.round(item.price)) / 0.8), [item.price]);
  const expectedReceived = calculatedListingPrice * 0.8;

  const handleAvatar = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Выберите файл изображения"); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage("Аватар должен быть не больше 5 МБ"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      setAvatarDataUrl(result);
      setAvatarName(file.name);
      setMessage("");
    };
    reader.readAsDataURL(file);
  };

  const changeStickerCount = (count: number) => {
    setStickerCount(count);
    setStickers((current) => Array.from({ length: count }, (_, index) => current[index] ?? ""));
  };

  const validStep2 = listingSkinName.trim().length > 0 && pattern.trim().length > 0 && stickers.length === stickerCount && stickers.every((sticker) => sticker.trim().length > 0);

  const submit = async () => {
    const price = Number(listingPriceGold);
    if (!avatarDataUrl || !validStep2 || price !== calculatedListingPrice) {
      setMessage("Проверьте аватар, данные скина и цену Marketplace");
      return;
    }
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryItemId: item.id, avatarDataUrl, listingSkinName: listingSkinName.trim(), pattern: pattern.trim(), stickerCount, stickers: stickers.map((sticker) => sticker.trim()), listingPriceGold: price }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Не удалось создать заявку");
      setMessage(`Заявка ${result.id} создана. Теперь ждите покупки модератором.`);
      setTimeout(onClose, 2200);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось создать заявку"); }
    finally { setLoading(false); }
  };

  return <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/[.05] p-4">
    <div className="flex items-center justify-between gap-2">
      <div><div className="text-sm font-black text-white">Вывод в Standoff 2</div><p className="mt-1 text-xs text-slate-400">Заполни три коротких шага</p></div>
      <div className="text-xs font-black text-violet-200">{step}/3</div>
    </div>

    <div className="mt-4 grid grid-cols-3 gap-1.5">
      {["Аватар", "Скин", "Вывод"].map((label, index) => <div key={label} className={`rounded-lg px-2 py-1.5 text-center text-[10px] font-black ${step === index + 1 ? "bg-violet-600 text-white" : step > index + 1 ? "bg-violet-500/20 text-violet-200" : "bg-white/5 text-slate-500"}`}>{index + 1}. {label}</div>)}
    </div>

    {step === 1 && <div className="mt-4">
      <label className="block cursor-pointer">
        <div className={`mx-auto flex aspect-square max-w-[180px] items-center justify-center overflow-hidden rounded-2xl border border-dashed ${avatarDataUrl ? "border-violet-400/60" : "border-white/15"} bg-black/30`}>
          {avatarDataUrl ? <img src={avatarDataUrl} alt="Аватар Standoff 2" className="h-full w-full object-cover" /> : <div className="px-4 text-center text-xs text-slate-400">Загрузите аватар из Standoff 2<br /><span className="mt-1 block text-[10px] text-slate-600">PNG, JPG, WEBP • до 5 МБ</span></div>}
        </div>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => handleAvatar(event.target.files?.[0])} />
      </label>
      {avatarName && <p className="mt-2 text-center text-[11px] text-slate-500">{avatarName}</p>}
      <button type="button" disabled={!avatarDataUrl} onClick={() => { setMessage(""); setStep(2); }} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">Продолжить</button>
    </div>}

    {step === 2 && <div className="mt-4 grid gap-2">
      <input value={listingSkinName} onChange={(e) => setListingSkinName(e.target.value)} placeholder="Название скина, который выставите" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50" />
      <input value={pattern} onChange={(e) => setPattern(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Pattern" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50" />
      <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-xs font-black text-white">Сколько наклеек на пушке?</div><div className="mt-2 grid grid-cols-5 gap-1.5">{[0,1,2,3,4].map((count) => <button key={count} type="button" onClick={() => changeStickerCount(count)} className={`rounded-lg py-2 text-xs font-black ${stickerCount === count ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400"}`}>{count}</button>)}</div></div>
      {stickers.map((sticker, index) => <input key={index} value={sticker} onChange={(e) => setStickers((current) => current.map((value, i) => i === index ? e.target.value : value))} placeholder={`Название наклейки ${index + 1}`} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50" />)}
      {message && <p className="text-xs text-rose-300">{message}</p>}
      <div className="mt-1 flex gap-2"><button type="button" onClick={() => setStep(1)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-slate-300">Назад</button><button type="button" disabled={!validStep2} onClick={() => { setMessage(""); setListingPriceGold(String(calculatedListingPrice)); setStep(3); }} className="flex-1 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Далее</button></div>
    </div>}

    {step === 3 && <div className="mt-4 grid gap-3">
      <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3"><div className="text-xs text-slate-400">Стоимость твоего выигрыша</div><div className="mt-1 text-lg font-black text-white">{item.price} Z</div><div className="mt-2 text-xs text-slate-400">С учётом комиссии Marketplace 20% выставить нужно:</div><div className="mt-1 text-xl font-black text-violet-200">{calculatedListingPrice} Gold</div><div className="mt-1 text-[11px] text-slate-500">После комиссии получится ≈ {expectedReceived} Gold</div></div>
      <input value={listingPriceGold} onChange={(e) => setListingPriceGold(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Введите цену, за которую выставили на рынке" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/50" />
      <p className="text-[11px] leading-4 text-slate-500">Цена должна совпасть с рассчитанной выше. После подтверждения заявка уйдёт модератору.</p>
      {message && <p className="text-xs text-violet-200">{message}</p>}
      <div className="flex gap-2"><button type="button" onClick={() => setStep(2)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-slate-300">Назад</button><button type="button" disabled={loading || Number(listingPriceGold) !== calculatedListingPrice} onClick={() => void submit()} className="flex-1 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">{loading ? "Отправляем..." : "Отправить на вывод"}</button></div>
    </div>}
  </div>;
}

export default function InventorySection({ items, sellingId, onSell }: { items: InventoryItem[]; sellingId: string | null; onSell: (item: InventoryItem) => void }) {
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  if (!items.length) return <StateMessage>Инвентарь пока пуст</StateMessage>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="rounded-[18px] border border-white/10 bg-[#0b1017] p-3"><div className="relative h-[150px] overflow-hidden rounded-[14px] border border-white/10 bg-[#080d15]"><Image src={item.image} alt={item.name} fill className="object-contain" sizes="260px" unoptimized /></div><p className={`mt-3 text-[0.62rem] uppercase tracking-[0.18em] ${getRarityTextClass(item.rarity)}`}>{item.rarity}</p><h2 className="mt-2 font-black text-white">{item.name}</h2><div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-300"><span>{item.price} Z</span><div className="flex gap-2"><button type="button" disabled={sellingId === item.id} onClick={() => onSell(item)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-black text-slate-300 disabled:opacity-50">{sellingId === item.id ? "Продажа..." : "Продать"}</button><button type="button" onClick={() => setWithdrawId(withdrawId === item.id ? null : item.id)} className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-100">Вывести</button></div></div>{withdrawId === item.id && <WithdrawalForm item={item} onClose={() => setWithdrawId(null)} />}</article>)}</div>;
}

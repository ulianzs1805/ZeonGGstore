"use client";

import { useMemo, useState } from "react";
import ImageUploadField from "../../ImageUploadField";
import { makeCaseFolder } from "../../utils/caseFolder";
import { newDrop, rarities, type DropDraft, type Rarity, type Role } from "../../types/admin";

export default function CreateCasePanel({ role }: { role: Role }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [caseImage, setCaseImage] = useState("");
  const [casePrice, setCasePrice] = useState(199);
  const [probabilityMode] = useState<"MANUAL" | "DYNAMIC">("MANUAL");
  const [drops, setDrops] = useState<DropDraft[]>([newDrop()]);
  const [message, setMessage] = useState("");
  const [createdCase, setCreatedCase] = useState<{ slug: string; name: string; drops: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const caseFolder = useMemo(() => makeCaseFolder(name), [name]);
  const totalProbability = drops.reduce((sum, drop) => sum + (Number.isFinite(drop.probability) ? drop.probability : 0), 0);
  const validDraft = Boolean(name.trim() && caseFolder && caseImage && drops.length > 0 && drops.every((drop) => drop.name.trim() && drop.image && Number.isInteger(drop.price) && drop.price > 0 && (role === "ADMIN" || drop.probability > 0)) && (role === "ADMIN" || Math.abs(totalProbability - 100) < 0.001));

  const updateDrop = (index: number, patch: Partial<DropDraft>) => setDrops((current) => current.map((drop, dropIndex) => dropIndex === index ? { ...drop, ...patch } : drop));

  const next = () => {
    setMessage("");
    if (!name.trim() || !caseFolder) return setMessage("Сначала укажите корректное название кейса.");
    if (!caseImage) return setMessage("Сначала загрузите изображение кейса.");
    setStep(2);
  };

  const createCase = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/cases", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image: caseImage, price: casePrice, probabilityMode, drops }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) setMessage(data?.error || "Не удалось создать кейс.");
      else {
        setCreatedCase({ slug: data.case.slug, name: data.case.name, drops: data.case.drops.length });
        setMessage("Кейс успешно создан и записан в audit log.");
      }
    } catch {
      setMessage("Ошибка сети. Проверьте подключение и попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateName = (value: string) => {
    if (caseImage || drops.some((drop) => drop.image)) {
      setMessage("Название изменено. Уже загруженные изображения остаются в прежней папке — при необходимости загрузите их заново.");
    }
    setName(value);
  };

  return <section className="space-y-5">
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className={step === 1 ? "text-violet-200" : ""}>1. Кейс</span><span>→</span><span className={step === 2 ? "text-violet-200" : ""}>2. Скины</span>
    </div>
    {step === 1 && <div className="space-y-5 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-6">
      <label className="block"><span className="mb-2 block text-sm font-bold">Название кейса</span><input value={name} onChange={(event) => updateName(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none" /></label>
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs"><p className="font-bold text-violet-100">Папка изображений: {caseFolder ? `/uploads/${caseFolder}/` : "появится после ввода названия"}</p><p className="mt-1 text-slate-400">Картинка кейса и изображения скинов используют одну папку этого кейса.</p></div>
      <ImageUploadField label="Изображение кейса" value={caseImage} onChange={setCaseImage} caseFolder={caseFolder} />
      <label className="block"><span className="mb-2 block text-sm font-bold">Цена, Z</span><input type="number" min="1" value={casePrice} onChange={(event) => setCasePrice(Number(event.target.value) || 0)} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none" /></label>
      <button type="button" onClick={next} className="w-full rounded-xl bg-violet-500 px-4 py-3 font-black">Далее: добавить скины</button>
    </div>}
    {step === 2 && <div className="space-y-4 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Скины</h2><p className="mt-1 text-xs text-slate-400">Папка: /uploads/{caseFolder}/</p></div><button type="button" onClick={() => setDrops((current) => [...current, newDrop()])} className="rounded-xl border border-violet-300/30 px-3 py-2 text-sm font-bold">Добавить скин</button></div>
      {drops.map((drop, index) => <article key={index} className="grid min-w-0 gap-4 rounded-xl border border-white/10 p-4">
        <input placeholder="Название скина" value={drop.name} onChange={(event) => updateDrop(index, { name: event.target.value })} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" />
        <select value={drop.rarity} onChange={(event) => updateDrop(index, { rarity: event.target.value as Rarity })} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2">{rarities.map((rarity) => <option key={rarity}>{rarity}</option>)}</select>
        <ImageUploadField label="Изображение скина" value={drop.image} onChange={(image) => updateDrop(index, { image })} caseFolder={caseFolder} />
        <input type="number" min="1" placeholder="Цена" value={drop.price} onChange={(event) => updateDrop(index, { price: Number(event.target.value) || 0 })} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" />
        <input type="number" min="0" max="100" step="0.01" placeholder="Вероятность" value={drop.probability} onChange={(event) => updateDrop(index, { probability: Number(event.target.value) || 0 })} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" />
        <button type="button" onClick={() => setDrops((current) => current.length > 1 ? current.filter((_, currentIndex) => currentIndex !== index) : current)} className="rounded-lg border border-red-300/20 px-3 py-2 text-sm text-red-200">Удалить</button>
      </article>)}
      <p className="text-xs text-slate-400">Сумма вероятностей: {totalProbability.toFixed(2)}%</p>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setStep(1)} className="rounded-xl border border-white/10 px-4 py-3 font-bold">Назад</button><button type="button" disabled={!validDraft || submitting} onClick={() => void createCase()} className="rounded-xl bg-violet-500 px-4 py-3 font-black disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Создание..." : "Создать кейс"}</button></div>
    </div>}
    {message && <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-200">{message}</p>}
    {createdCase && <p className="text-sm text-emerald-200">Создан: {createdCase.name} · {createdCase.drops} drops</p>}
  </section>;
}

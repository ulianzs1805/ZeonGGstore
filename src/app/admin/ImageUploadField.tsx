"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export default function ImageUploadField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("");

  const upload = async (file: File) => {
    setStatus("Обрабатываем изображение...");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/admin/uploads", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(data?.error || "Не удалось загрузить изображение.");
      return;
    }
    onChange(data.imageUrl);
    setStatus("PNG · прозрачный фон · обработано");
  };

  const accept = (file: File | undefined) => {
    if (file) void upload(file);
  };

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <button type="button" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files[0]); }} className={`relative flex min-h-52 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed p-5 text-center transition ${dragging ? "border-violet-300 bg-violet-400/15" : "border-violet-300/30 bg-black/20 hover:border-violet-200/70"}`}>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(event) => accept(event.target.files?.[0])} />
        {value ? <><Image src={value} alt="Processed preview" fill className="object-contain p-5" unoptimized /><span className="absolute bottom-3 rounded-full bg-black/70 px-3 py-1 text-[0.65rem] font-bold text-emerald-200">{status || "PNG · обработано"}</span></> : <><span className="text-4xl font-light text-violet-200">+</span><span className="mt-2 text-sm font-bold text-white">{dragging ? "Отпустите файл для загрузки" : "Загрузить изображение"}</span><span className="mt-2 text-xs text-slate-400">PNG / JPG / WEBP · до 8 МБ</span><span className="mt-1 text-xs text-slate-500">Нажмите или перетащите файл сюда</span></>}
      </button>
      {value && <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-emerald-200">{status || "Изображение обработано"}</span><button type="button" onClick={() => { onChange(""); setStatus(""); }} className="text-xs font-bold text-slate-400 hover:text-white">Заменить</button></div>}
    </div>
  );
}
"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export default function ImageUploadField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    setStatus("Загружаем изображение...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/uploads", { method: "POST", body: formData });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.imageUrl) {
        setStatus(data?.error || "Не удалось загрузить изображение.");
        return;
      }
      onChange(data.imageUrl);
      setStatus(data.processed === false ? "Изображение сохранено без удаления фона" : "Изображение обработано и готово");
    } catch {
      setStatus("Ошибка сети. Попробуйте загрузить изображение ещё раз.");
    } finally {
      setUploading(false);
    }
  };

  const accept = (file: File | undefined) => {
    if (file) void upload(file);
  };

  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files[0]); }} className={`relative flex min-h-52 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed p-5 text-center transition disabled:cursor-wait disabled:opacity-70 ${dragging ? "border-violet-300 bg-violet-400/15" : "border-violet-300/30 bg-black/20 hover:border-violet-200/70"}`}>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(event) => { accept(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        {value ? <><Image src={value} alt="Processed preview" fill className="object-contain p-5" sizes="(max-width: 640px) 100vw, 520px" unoptimized /><span className="absolute bottom-3 max-w-[90%] rounded-full bg-black/70 px-3 py-1 text-[0.65rem] font-bold text-emerald-200">{status || "Изображение готово"}</span></> : <><span className="text-4xl font-light text-violet-200">{uploading ? "…" : "+"}</span><span className="mt-2 text-sm font-bold text-white">{uploading ? "Загрузка и обработка..." : dragging ? "Отпустите файл для загрузки" : "Загрузить изображение"}</span><span className="mt-2 text-xs text-slate-400">PNG / JPG / WEBP · до 8 МБ</span><span className="mt-1 text-xs text-slate-500">Нажмите или перетащите файл сюда</span></>}
      </button>
      {status && !value && <p className="mt-2 text-xs text-amber-200">{status}</p>}
      {value && <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-emerald-200">{status || "Изображение готово"}</span><button type="button" disabled={uploading} onClick={() => { onChange(""); setStatus(""); }} className="text-xs font-bold text-slate-400 hover:text-white disabled:opacity-50">Заменить</button></div>}
    </div>
  );
}

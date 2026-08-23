"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";

export default function ImageUploadField({
  label,
  value,
  onChange,
  caseFolder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  caseFolder?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (caseFolder?.trim()) formData.set("caseFolder", caseFolder.trim());
      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.imageUrl) {
        setError(data?.error || "Не удалось загрузить изображение.");
        return;
      }
      onChange(String(data.imageUrl));
    } catch {
      setError("Ошибка сети при загрузке изображения.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="block text-sm font-bold">{label}</label>
        <span className="text-[11px] text-slate-400">PNG · JPG · WEBP · до 12 МБ</span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }}
        className="sr-only"
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex min-h-24 w-full items-center justify-center rounded-xl border border-dashed border-violet-300/35 bg-black/20 px-4 py-5 text-center transition hover:border-violet-300/70 hover:bg-violet-500/10 disabled:cursor-wait disabled:opacity-60"
      >
        <span>
          <span className="block text-lg font-black text-violet-100">{uploading ? "Загрузка изображения..." : value ? "Заменить изображение" : "Выбрать изображение"}</span>
          <span className="mt-1 block text-xs text-slate-400">Нажмите сюда и выберите файл</span>
        </span>
      </button>

      {value && (
        <div className="relative h-36 overflow-hidden rounded-xl border border-white/10 bg-black/20">
          <Image
            src={value}
            alt={label}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-contain p-5"
            unoptimized
          />
        </div>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

"use client";

import Image from "next/image";
import { useId, useState } from "react";

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
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-bold">{label}</label>
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }}
        className="block w-full text-sm"
      />
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
      {uploading && <p className="text-xs text-slate-400">Загрузка и обработка...</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

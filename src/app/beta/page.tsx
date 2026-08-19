"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function BetaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/beta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error || "Неверный Beta-код.");
      setBusy(false);
      return;
    }
    router.replace(safeReturnTo(searchParams.get("returnTo")));
    router.refresh();
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#05030a] px-4 py-8 text-white"><section className="w-full max-w-md rounded-[28px] border border-violet-400/20 bg-[#0b0715] p-6 shadow-[0_0_60px_rgba(124,58,237,0.18)] sm:p-8"><p className="text-xs font-black uppercase tracking-[0.34em] text-violet-300">ZEON GGSTORE</p><h1 className="mt-5 text-3xl font-black tracking-[-0.06em] sm:text-4xl">Закрытый Beta-доступ</h1><p className="mt-4 text-sm leading-6 text-slate-300">Сайт находится в закрытом тестировании. Введите Beta-код, чтобы продолжить.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Введите Beta-код</span><input autoFocus type="password" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none transition focus:border-violet-300/60" /></label>{error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}<button type="submit" disabled={busy || !code} className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-black transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Проверяем..." : "Войти в Beta"}</button></form></section></main>;
}

export default function BetaPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#05030a] px-4 text-white"><p className="text-sm text-slate-300">Загрузка...</p></main>}><BetaForm /></Suspense>;
}
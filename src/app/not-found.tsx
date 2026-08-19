import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#04070d] px-6 text-white">
      <div className="max-w-md rounded-[28px] border border-white/10 bg-[#0a0f18]/90 p-8 text-center shadow-[0_0_30px_rgba(168,85,247,0.18)]">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-violet-300/90">
          404
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-[-0.06em] text-white">
          Страница не найдена
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Эта страница отсутствует в ZeonGGStore.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.38)]"
        >
          На главную
        </Link>
      </div>
    </main>
  );
}

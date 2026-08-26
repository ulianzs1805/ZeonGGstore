import Link from "next/link";

export default function GamesPage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-72px)] max-w-[1440px] px-4 pb-32 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-12">
      <section className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-300">ZeonGGStore</p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">Игры</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Здесь собраны игровые режимы ZeonGGStore. Новые режимы будут появляться в этом разделе.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/upgrade" className="group relative overflow-hidden rounded-[28px] border border-violet-300/20 bg-gradient-to-br from-violet-500/20 via-[#141827] to-[#0a0d14] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)] transition hover:-translate-y-1 hover:border-violet-300/45">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="relative">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-200/20 bg-violet-400/10 text-2xl">⚡</div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Доступно сейчас</p>
            <h2 className="mt-2 text-2xl font-black text-white">Апгрейдер</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Улучшай предметы, выбирай шанс и рискуй ради более дорогого дропа.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-white">Играть <span aria-hidden="true">→</span></span>
          </div>
        </Link>
      </section>
    </main>
  );
}

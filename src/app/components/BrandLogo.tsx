"use client";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

const logoSrc = "data:image/webp;base64,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";

export default function BrandLogo({ className = "", compact = false }: BrandLogoProps) {
  return (
    <div className={`relative flex items-center gap-3 ${className}`}>
      <div className="relative shrink-0 overflow-hidden rounded-2xl border border-violet-300/30 bg-[#0a0f18] shadow-[0_0_24px_rgba(124,58,237,0.35)]">
        <img src={logoSrc} alt="ZeonGGStore" className="h-12 w-12 object-cover sm:h-14 sm:w-14" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-violet-500/15 via-transparent to-orange-400/15" />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-lg font-black tracking-[-0.06em] text-[#f4f1ff] sm:text-xl">ZEON</div>
          <div className="mt-1 text-[0.55rem] font-black tracking-[0.28em] text-violet-300/90 sm:text-[0.6rem]">GGSTORE</div>
        </div>
      )}
    </div>
  );
}

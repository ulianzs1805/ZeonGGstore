const normalizeRarity = (rarity: string) => rarity.trim().toUpperCase();

export function getRarityTextClass(rarity: string) {
  switch (normalizeRarity(rarity)) {
    case "ARCANE":
      return "text-red-400";
    case "LEGENDARY":
      return "text-pink-300";
    case "NAMELESS":
      return "text-yellow-300";
    case "MYTHIC":
      return "text-fuchsia-300";
    case "EPIC":
      return "text-violet-300";
    case "RARE":
      return "text-cyan-300";
    case "UNCOMMON":
      return "text-emerald-300";
    default:
      return "text-slate-300";
  }
}

export const rarityCardStyles: Record<string, string> = {
  Common: "border-slate-400/50 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_rgba(15,23,42,0.76)_44%,_rgba(2,6,23,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(148,163,184,0.16),0_16px_30px_rgba(2,6,23,0.54)]",
  Uncommon: "border-emerald-400/50 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(10,26,23,0.8)_46%,_rgba(2,6,23,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(16,185,129,0.18),0_16px_28px_rgba(5,111,82,0.32)]",
  Rare: "border-cyan-400/50 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_rgba(12,25,38,0.82)_48%,_rgba(2,6,23,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(34,211,238,0.18),0_16px_28px_rgba(8,145,178,0.28)]",
  Epic: "border-violet-400/50 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.20),_rgba(31,18,49,0.82)_48%,_rgba(11,8,18,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(168,85,247,0.18),0_18px_32px_rgba(76,29,149,0.33)]",
  Legendary: "border-pink-300/55 bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.22),_rgba(55,18,43,0.82)_48%,_rgba(16,6,13,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(244,114,182,0.2),0_18px_34px_rgba(157,23,77,0.36)]",
  ARCANE: "border-red-400/60 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.24),_rgba(69,10,10,0.84)_48%,_rgba(16,5,5,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(248,113,113,0.22),0_18px_34px_rgba(153,27,27,0.4)]",
  NAMELESS: "border-yellow-300/60 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.24),_rgba(66,40,3,0.84)_48%,_rgba(16,10,2,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(250,204,21,0.22),0_18px_34px_rgba(161,98,7,0.4)]",
};

export function getRarityCardClass(rarity: string) {
  const normalized = normalizeRarity(rarity);
  const key = normalized === "ARCANE" || normalized === "NAMELESS" ? normalized : normalized.charAt(0) + normalized.slice(1).toLowerCase();
  return rarityCardStyles[key] ?? rarityCardStyles.Common;
}

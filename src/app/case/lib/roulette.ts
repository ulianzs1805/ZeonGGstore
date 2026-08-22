import type { CaseItem } from "./types";

export const TRACK_GAP = 14;
export const SLOT_COUNT = 28;
export const CARD_WIDTH = 180;
export const CARD_STEP = CARD_WIDTH + TRACK_GAP;

export const pickWeightedRandom = (items: CaseItem[]) => {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + Math.max(0, item.chance), 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let point = Math.random() * total;
  for (const item of items) {
    point -= Math.max(0, item.chance);
    if (point <= 0) return item;
  }
  return items[items.length - 1];
};

export const buildRouletteSlots = (items: CaseItem[], serverWinner?: CaseItem) => {
  if (!items.length) return { winner: null, winnerSlotIndex: 0, slots: [] as CaseItem[] };
  const winner = serverWinner ?? pickWeightedRandom(items) ?? items[0];
  const winnerSlotIndex = 12 + Math.floor(Math.random() * 5);
  const uidBase = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
  const slots = Array.from({ length: SLOT_COUNT }, (_, index) => ({
    ...(index === winnerSlotIndex ? winner : (pickWeightedRandom(items) ?? items[0])),
    slotUid: `${uidBase}-${index}`,
  }));
  return { winner, winnerSlotIndex, slots };
};

export const scoreDrop = (item: CaseItem) =>
  ({ ARCANE: 1000, Arcane: 1000, Legendary: 900, LEGENDARY: 900, Epic: 700, EPIC: 700, Rare: 600, Uncommon: 400 }[item.rarity] ?? 200);

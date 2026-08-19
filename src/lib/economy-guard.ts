const MIN_CASE_PRICE = 10;
const MAX_CASE_PRICE = 10000;
const MIN_DROP_PRICE = 1;
const MAX_DROP_PRICE = 100000;
export const VALID_RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "ARCANE", "NAMELESS"] as const;

export function validateCasePrice(price: number) {
  return Number.isInteger(price) && price >= MIN_CASE_PRICE && price <= MAX_CASE_PRICE;
}

export function validateDropPrice(price: number) {
  return Number.isInteger(price) && price >= MIN_DROP_PRICE && price <= MAX_DROP_PRICE;
}

export function validateRarity(rarity: string) {
  return VALID_RARITIES.some((item) => item.toUpperCase() === rarity.trim().toUpperCase());
}

export function validateChances(chances: number[]) {
  return chances.length > 0
    && chances.every((chance) => Number.isFinite(chance) && chance > 0 && chance <= 100)
    && Math.abs(chances.reduce((sum, chance) => sum + chance, 0) - 100) <= 0.0001;
}

export function economyBlockedMessage() {
  return "SYSTEM CHANGE BLOCKED\nИзменение заблокировано системой, так как оно может нарушить экономическую целостность ZEON.";
}
import type { ProbabilityMode } from "@prisma/client";

type ProbabilityDrop = {
  id: string;
  price: number;
  probability: number;
  rarity: string;
};

const DEFAULT_RARITY_WEIGHTS: Record<string, number> = {
  NAMELESS: 0.05,
  COMMON: 1,
  UNCOMMON: 1.5,
  RARE: 3,
  EPIC: 6,
  LEGENDARY: 12,
  MYTHIC: 20,
  ARCANE: 28,
};
const DEFAULT_PRICE_EXPONENT = 1.25;
const DEFAULT_PRICE_REFERENCE = 100;

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readRarityWeights() {
  const configured = process.env.ZEON_RARITY_WEIGHTS_JSON;
  if (!configured) return DEFAULT_RARITY_WEIGHTS;
  try {
    const parsed = JSON.parse(configured) as Record<string, unknown>;
    const weights = { ...DEFAULT_RARITY_WEIGHTS };
    for (const [rarity, weight] of Object.entries(parsed)) {
      if (typeof weight === "number" && Number.isFinite(weight) && weight > 0) weights[rarity.toUpperCase()] = weight;
    }
    return weights;
  } catch {
    return DEFAULT_RARITY_WEIGHTS;
  }
}

export function getProbabilityPolicy() {
  return {
    rarityWeights: readRarityWeights(),
    priceExponent: readPositiveNumber(process.env.ZEON_PRICE_EXPONENT, DEFAULT_PRICE_EXPONENT),
    priceReference: readPositiveNumber(process.env.ZEON_PRICE_REFERENCE, DEFAULT_PRICE_REFERENCE),
  };
}

export function calculateFinalProbabilities<T extends ProbabilityDrop>(drops: T[], mode: ProbabilityMode = "DYNAMIC") {
  if (!drops.length) return [];
  const policy = getProbabilityPolicy();
  const weights = drops.map((drop) => {
    if (!Number.isFinite(drop.price) || drop.price <= 0 || !Number.isFinite(drop.probability) || drop.probability <= 0) return 0;
    if (mode === "MANUAL") return drop.probability;
    const rarityWeight = policy.rarityWeights[drop.rarity.trim().toUpperCase()] ?? policy.rarityWeights.NAMELESS;
    const normalizedPrice = drop.price / policy.priceReference;
    const priceFactor = 1 / Math.pow(normalizedPrice, policy.priceExponent);
    return rarityWeight * priceFactor;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return drops.map(() => 0);

  return weights.map((weight) => (weight / totalWeight) * 100);
}

export function withFinalProbabilities<T extends ProbabilityDrop>(drops: T[], mode: ProbabilityMode = "DYNAMIC") {
  const probabilities = calculateFinalProbabilities(drops, mode);
  return drops.map((drop, index) => ({ ...drop, probability: probabilities[index] }));
}

export function calculatePriceWeightedProbabilities<T extends ProbabilityDrop>(drops: T[]) {
  return calculateFinalProbabilities(drops, "DYNAMIC");
}

export function withPriceWeightedProbabilities<T extends ProbabilityDrop>(drops: T[]) {
  return withFinalProbabilities(drops, "DYNAMIC");
}

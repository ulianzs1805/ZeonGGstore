import type { ProbabilityMode } from "@prisma/client";

type ProbabilityDrop = { id: string; price: number; probability: number; rarity: string; name?: string };
const DEFAULT_RARITY_WEIGHTS: Record<string, number> = { NAMELESS: 0.05, COMMON: 1, UNCOMMON: 1.5, RARE: 3, EPIC: 6, LEGENDARY: 12, MYTHIC: 20, ARCANE: 28 };
const KNIFE_POOL_PERCENT = 6;
const DEFAULT_PRICE_EXPONENT = 1;
const DEFAULT_PRICE_REFERENCE = 100;
function readPositiveNumber(value: string | undefined, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback; }
function readRarityWeights() { const configured = process.env.ZEON_RARITY_WEIGHTS_JSON; if (!configured) return DEFAULT_RARITY_WEIGHTS; try { const parsed = JSON.parse(configured) as Record<string, unknown>; const weights = { ...DEFAULT_RARITY_WEIGHTS }; for (const [rarity, weight] of Object.entries(parsed)) if (typeof weight === "number" && Number.isFinite(weight) && weight > 0) weights[rarity.toUpperCase()] = weight; return weights; } catch { return DEFAULT_RARITY_WEIGHTS; } }
export function getProbabilityPolicy() { return { rarityWeights: readRarityWeights(), priceExponent: readPositiveNumber(process.env.ZEON_PRICE_EXPONENT, DEFAULT_PRICE_EXPONENT), priceReference: readPositiveNumber(process.env.ZEON_PRICE_REFERENCE, DEFAULT_PRICE_REFERENCE), knifePoolPercent: KNIFE_POOL_PERCENT }; }
/** Weapon-name classification deliberately keeps M4 Samurai out of the knife pool. */
export function isKnifeDrop(drop: Pick<ProbabilityDrop, "name">) { const name = (drop.name ?? "").trim().toLocaleLowerCase("ru-RU"); return /butterfly|karambit|kunai|tanto|kukri|fang|m9 bayonet|bayonet|flip|gut|huntsman|falchion|stiletto|jkommando|scorpion|daggers|dual daggers|knife/i.test(name); }
function priceWeight(price: number, exponent: number, reference: number) { if (!Number.isFinite(price) || price <= 0) return 0; return 1 / Math.pow(Math.max(price / reference, 0.0001), exponent); }
export function calculateFinalProbabilities<T extends ProbabilityDrop>(drops: T[], mode: ProbabilityMode = "DYNAMIC") {
  if (!drops.length) return [];
  const policy = getProbabilityPolicy();
  const knifeIndexes = drops.map((d, i) => ({ d, i })).filter(x => isKnifeDrop(x.d) && Number.isFinite(x.d.price) && x.d.price > 0);
  const knifeWeightTotal = knifeIndexes.reduce((sum, x) => sum + priceWeight(x.d.price, policy.priceExponent, policy.priceReference), 0);
  const hasKnifePool = knifeIndexes.length > 0 && knifeWeightTotal > 0;
  if (mode === "MANUAL" && !hasKnifePool) return drops.map(d => Number.isFinite(d.probability) && d.probability > 0 ? d.probability : 0);
  const knifeIndexesSet = new Set(knifeIndexes.map(x => x.i));
  const nonKnifeWeights = drops.map((d, i) => {
    if (knifeIndexesSet.has(i) || !Number.isFinite(d.price) || d.price <= 0) return 0;
    if (mode === "MANUAL") return Number.isFinite(d.probability) && d.probability > 0 ? d.probability : 0;
    const rarityWeight = policy.rarityWeights[d.rarity.trim().toUpperCase()] ?? policy.rarityWeights.NAMELESS;
    return rarityWeight * priceWeight(d.price, policy.priceExponent, policy.priceReference);
  });
  const nonKnifeTotal = nonKnifeWeights.reduce((sum, w) => sum + w, 0);
  const nonKnifePool = hasKnifePool ? 100 - policy.knifePoolPercent : 100;
  return drops.map((d, i) => {
    if (hasKnifePool && knifeIndexesSet.has(i)) return (priceWeight(d.price, policy.priceExponent, policy.priceReference) / knifeWeightTotal) * policy.knifePoolPercent;
    if (!Number.isFinite(nonKnifeTotal) || nonKnifeTotal <= 0) return 0;
    return (nonKnifeWeights[i] / nonKnifeTotal) * nonKnifePool;
  });
}
export function withFinalProbabilities<T extends ProbabilityDrop>(drops: T[], mode: ProbabilityMode = "DYNAMIC") { const probabilities = calculateFinalProbabilities(drops, mode); return drops.map((drop, index) => ({ ...drop, probability: probabilities[index] })); }
export function calculatePriceWeightedProbabilities<T extends ProbabilityDrop>(drops: T[]) { return calculateFinalProbabilities(drops, "DYNAMIC"); }
export function withPriceWeightedProbabilities<T extends ProbabilityDrop>(drops: T[]) { return withFinalProbabilities(drops, "DYNAMIC"); }

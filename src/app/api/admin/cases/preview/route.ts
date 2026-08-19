import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { validateChances, validateDropPrice, validateRarity } from "@/lib/economy-guard";
import { calculateFinalProbabilities, getProbabilityPolicy } from "@/lib/price-weighted-chances";

type PreviewDrop = { name?: unknown; rarity?: unknown; price?: unknown; probability?: unknown };

export async function POST(request: Request) {
  const access = await requirePermission("CASE_CREATE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null) as { probabilityMode?: unknown; drops?: unknown } | null;
  const mode = body?.probabilityMode === "DYNAMIC" ? "DYNAMIC" : "MANUAL";
  const drops = Array.isArray(body?.drops) ? body.drops as PreviewDrop[] : [];
  const normalized = drops.map((drop) => ({
    name: typeof drop.name === "string" ? drop.name.trim() : "",
    rarity: typeof drop.rarity === "string" ? drop.rarity.trim() : "",
    price: typeof drop.price === "number" ? drop.price : NaN,
    probability: typeof drop.probability === "number" ? drop.probability : NaN,
  }));
  if (!normalized.length || normalized.some((drop) => !validateRarity(drop.rarity) || !validateDropPrice(drop.price))) {
    return NextResponse.json({ error: "Укажите корректные rarity и положительные цены всех Drop." }, { status: 400 });
  }
  const baseWeights = access.user.role === "ADMIN" ? normalized.map(() => 100 / normalized.length) : normalized.map((drop) => drop.probability);
  if (!validateChances(baseWeights)) return NextResponse.json({ error: "Base Weight должен быть больше 0, а сумма должна равняться 100%." }, { status: 400 });
  const calculatedProbabilities = calculateFinalProbabilities(normalized.map((drop, index) => ({ ...drop, probability: baseWeights[index], id: String(index) })), mode);
  return NextResponse.json({
    mode,
    policy: mode === "DYNAMIC" ? getProbabilityPolicy() : null,
    drops: normalized.map((drop, index) => ({ ...drop, baseWeight: baseWeights[index], calculatedProbability: calculatedProbabilities[index] })),
    total: calculatedProbabilities.reduce((sum, probability) => sum + probability, 0),
  });
}

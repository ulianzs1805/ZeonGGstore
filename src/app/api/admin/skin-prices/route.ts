import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";
import { validateDropPrice } from "@/lib/economy-guard";
import { calculateFinalProbabilities } from "@/lib/price-weighted-chances";
import { ensureSystemCatalog } from "@/lib/system-catalog";

const DEV_MAX_PRICE = 10000;
const NPN1_MAX_PRICE = 100000;

function maxPriceForRole(role: "DEV" | "NPN1_DEV") {
  return role === "DEV" ? DEV_MAX_PRICE : NPN1_MAX_PRICE;
}

function attachCaseProbabilities<T extends { id: string; caseId: string; price: number; probability: number; rarity: string; case: { probabilityMode: "MANUAL" | "DYNAMIC" } }>(drops: T[]) {
  const probabilities = new Map<string, number>();
  const caseIds = [...new Set(drops.map((drop) => drop.caseId))];
  for (const caseId of caseIds) {
    const caseDrops = drops.filter((drop) => drop.caseId === caseId);
    const caseProbabilities = calculateFinalProbabilities(caseDrops, caseDrops[0]?.case.probabilityMode ?? "MANUAL");
    caseDrops.forEach((drop, index) => probabilities.set(drop.id, caseProbabilities[index]));
  }
  return probabilities;
}

export async function GET() {
  const access = await requirePermission("SKIN_PRICE_MANAGE");
  if (!access.user) return access.response;
  await ensureSystemCatalog(prisma);

  const drops = await prisma.drop.findMany({
    include: { case: { select: { id: true, name: true, slug: true, environment: true, isActive: true, probabilityMode: true } } },
    orderBy: [{ case: { name: "asc" } }, { name: "asc" }],
  });

  const effectiveProbabilities = attachCaseProbabilities(drops);
  const uniqueSkins = new Map<string, typeof drops[number] & { effectiveProbability: number; caseCount: number; caseNames: string[] }>();
  for (const drop of drops) {
    const identity = `${drop.name.trim().toLowerCase()}::${drop.image}`;
    const existing = uniqueSkins.get(identity);
    if (existing) {
      if (!existing.caseNames.includes(drop.case.name)) existing.caseNames.push(drop.case.name);
      existing.caseCount = existing.caseNames.length;
      continue;
    }
    uniqueSkins.set(identity, { ...drop, effectiveProbability: effectiveProbabilities.get(drop.id) ?? 0, caseCount: 1, caseNames: [drop.case.name] });
  }
  return NextResponse.json({
    drops: [...uniqueSkins.values()],
    policy: { minPrice: 1, maxPrice: maxPriceForRole(access.user.role as "DEV" | "NPN1_DEV") },
  });
}

export async function PATCH(request: Request) {
  const access = await requirePermission("SKIN_PRICE_MANAGE");
  if (!access.user) return access.response;
  await ensureSystemCatalog(prisma);

  const body = await request.json().catch(() => null) as { dropId?: unknown; price?: unknown } | null;
  const dropId = typeof body?.dropId === "string" ? body.dropId.trim() : "";
  const price = typeof body?.price === "number" ? body.price : NaN;
  const maxPrice = maxPriceForRole(access.user.role as "DEV" | "NPN1_DEV");

  if (!dropId) return NextResponse.json({ error: "Укажите dropId." }, { status: 400 });
  if (!validateDropPrice(price) || price > maxPrice) {
    return NextResponse.json({ error: `Цена должна быть целым числом от 1 до ${maxPrice} Z-Coin.` }, { status: 400 });
  }

  const target = await prisma.drop.findUnique({ where: { id: dropId }, include: { case: { select: { name: true, slug: true, environment: true, probabilityMode: true } } } });
  if (!target) return NextResponse.json({ error: "Скин не найден." }, { status: 404 });
  if (target.case.slug === "furious") return NextResponse.json({ error: "Цены Furious collection зафиксированы и не изменяются через админ-панель." }, { status: 403 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const matchingDrops = await tx.drop.findMany({ where: { name: target.name, image: target.image }, select: { id: true, caseId: true } });
      const caseDropsBefore = await tx.drop.findMany({ where: { caseId: target.caseId }, select: { id: true, caseId: true, price: true, probability: true, rarity: true } });
      const oldEffectiveProbability = calculateFinalProbabilities(caseDropsBefore, target.case.probabilityMode)[caseDropsBefore.findIndex((drop) => drop.id === target.id)];
      await tx.drop.updateMany({ where: { id: { in: matchingDrops.map((drop) => drop.id) } }, data: { price } });
      const inventoryUpdate = await tx.inventoryItem.updateMany({ where: { itemId: { in: matchingDrops.map((drop) => drop.id) } }, data: { price } });
      const result = await tx.drop.findUniqueOrThrow({ where: { id: dropId } });
      const caseDrops = await tx.drop.findMany({ where: { caseId: target.caseId }, select: { id: true, caseId: true, price: true, probability: true, rarity: true } });
      const effectiveProbabilities = calculateFinalProbabilities(caseDrops, target.case.probabilityMode);
      const effectiveProbability = effectiveProbabilities[caseDrops.findIndex((drop) => drop.id === result.id)];
      await tx.auditLog.create({
        data: {
          actorUserId: access.user!.id,
          actorRole: access.user!.role,
          actorAdminId: null,
          action: "SKIN_PRICE_UPDATED",
          targetType: "DROP",
          targetId: dropId,
          metadata: JSON.stringify({ skinName: target.name, caseName: target.case.name, environment: target.case.environment, oldPrice: target.price, newPrice: price, affectedDropCount: matchingDrops.length, affectedInventoryCount: inventoryUpdate.count, oldEffectiveProbability, newEffectiveProbability: effectiveProbability, maxPrice }),
          status: "SUCCESS",
        },
      });
      return { drop: { ...result, effectiveProbability }, caseDrops: caseDrops.map((drop, index) => ({ ...drop, effectiveProbability: effectiveProbabilities[index] })), affectedDropCount: matchingDrops.length, affectedInventoryCount: inventoryUpdate.count };
    });
    return NextResponse.json(updated);
  } catch (error) {
    await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "SKIN_PRICE_UPDATE_FAILED", targetType: "DROP", targetId: dropId, metadata: { error: String(error) }, status: "FAILED" });
    return NextResponse.json({ error: "Не удалось изменить стоимость скина." }, { status: 500 });
  }
}
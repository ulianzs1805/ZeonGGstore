import { Environment, Prisma, PrismaClient } from "@prisma/client";

export const SYSTEM_DROPS = [
  { name: "AKR Necromancer", rarity: "LEGENDARY", image: "/skins/akr-necromancer.png", probability: 55, priceMultiplier: 2 },
  { name: "G22 Monster", rarity: "EPIC", image: "/skins/g22-monster.png", probability: 20, priceMultiplier: 4 },
  { name: "AWM Winter Sport", rarity: "LEGENDARY", image: "/skins/awm-winter-sport.png", probability: 15, priceMultiplier: 7 },
  { name: "M4 Samurai", rarity: "ARCANE", image: "/skins/m4-samurai.png", probability: 10, priceMultiplier: 10 },
] as const;

export const FURIOUS_DROPS = [
  { name: "M4 PRO", rarity: "RARE", image: "/skins/furious/m4-pro.png", probability: 8, price: 25 },
  { name: "UMP45 SHARK", rarity: "RARE", image: "/skins/furious/ump45-shark.png", probability: 8, price: 25 },
  { name: "FAMAS BEAGLE", rarity: "EPIC", image: "/skins/furious/famas-beagle.png", probability: 8, price: 27 },
  { name: "M40 Quake", rarity: "RARE", image: "/skins/furious/m40-quake.png", probability: 8, price: 26 },
  { name: "Desert Eagle \"Red Dragon\"", rarity: "RARE", image: "/skins/furious/desert-eagle-red-dragon.png", probability: 8, price: 35 },
  { name: "AWM \"Scratch\"", rarity: "RARE", image: "/skins/furious/awm-scratch.png", probability: 8, price: 44 },
  { name: "AKR \"Sport\"", rarity: "EPIC", image: "/skins/furious/akr-sport.png", probability: 7, price: 95 },
  { name: "AWM \"Gear\"", rarity: "LEGENDARY", image: "/skins/furious/awm-gear.png", probability: 7, price: 96 },
  { name: "SM1014 \"Necromancer\"", rarity: "LEGENDARY", image: "/skins/furious/sm1014-necromancer.png", probability: 7, price: 104 },
  { name: "UMP45 \"Winged\"", rarity: "LEGENDARY", image: "/skins/furious/ump45-winged.png", probability: 7, price: 123 },
  { name: "P350 \"Forest Spirit\"", rarity: "ARCANE", image: "/skins/furious/p350-forest-spirit.png", probability: 6, price: 579 },
  { name: "FAMAS \"Fury\"", rarity: "ARCANE", image: "/skins/furious/famas-fury.png", probability: 6, price: 639 },
  { name: "Karambit \"Dragon Glass\"", rarity: "ARCANE", image: "/skins/furious/karambit-dragon-glass.png", probability: 3, price: 6290 },
  { name: "Karambit \"Universe\"", rarity: "ARCANE", image: "/skins/furious/karambit-universe.png", probability: 3, price: 6700 },
  { name: "Karambit \"Scratch\"", rarity: "ARCANE", image: "/skins/furious/karambit-scratch.png", probability: 3, price: 7250 },
  { name: "Karambit \"Claw\"", rarity: "ARCANE", image: "/skins/furious/karambit-claw.png", probability: 3, price: 13680 },
] as const;

const LEGACY_FURIOUS_DROP_NAMES = ["AKR Necromancer", "G22 Monster", "M4 Samurai", "AWM Winter Sport"] as const;

let syncPromise: Promise<void> | null = null;

export function ensureSystemCatalog(prisma: PrismaClient) {
  syncPromise ??= prisma.$transaction(async (tx) => {
    // pg_advisory_xact_lock returns PostgreSQL's `void` type. Prisma cannot
    // deserialize that through $queryRaw, so execute it as a command instead.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(91736421)`;
    await syncCatalog(tx);
  }).catch((error) => {
    syncPromise = null;
    throw error;
  });
  return syncPromise;
}

type CatalogDb = PrismaClient | Prisma.TransactionClient;

async function syncCatalog(db: CatalogDb) {
  const cases = await db.case.findMany({
    where: { environment: Environment.SYSTEM, isActive: true },
    include: { drops: { orderBy: { createdAt: "asc" } } },
  });

  for (const currentCase of cases) {
    if (currentCase.slug === "furious") {
      await db.drop.deleteMany({
        where: {
          caseId: currentCase.id,
          name: { in: [...LEGACY_FURIOUS_DROP_NAMES] },
        },
      });
    }

    const targetProbabilityMode = currentCase.slug === "furious" ? "MANUAL" : "DYNAMIC";
    if (currentCase.probabilityMode !== targetProbabilityMode) {
      await db.case.update({
        where: { id: currentCase.id },
        data: { probabilityMode: targetProbabilityMode },
      });
    }

    const definitions = currentCase.slug === "furious" ? FURIOUS_DROPS : SYSTEM_DROPS;
    const existingDrops = await db.drop.findMany({
      where: { caseId: currentCase.id },
      orderBy: { createdAt: "asc" },
    });

    const unmatched = existingDrops.filter((drop) => !definitions.some((definition) => definition.name === drop.name));
    const reusable = unmatched.slice(0, Math.max(0, definitions.length - existingDrops.filter((drop) => definitions.some((definition) => definition.name === drop.name)).length));
    const reusableById = new Set(reusable.map((drop) => drop.id));

    for (const definition of definitions) {
      const data = {
        name: definition.name,
        rarity: definition.rarity,
        image: definition.image,
        probability: definition.probability,
        price: "price" in definition ? definition.price : currentCase.price * definition.priceMultiplier,
        environment: Environment.SYSTEM,
      };

      const existingByName = existingDrops.find((drop) => drop.name === definition.name);
      if (existingByName) {
        await db.drop.update({ where: { id: existingByName.id }, data });
        continue;
      }

      const reusableDrop = reusable.find((drop) => reusableById.has(drop.id));
      if (reusableDrop) {
        reusableById.delete(reusableDrop.id);
        await db.drop.update({ where: { id: reusableDrop.id }, data });
        continue;
      }

      await db.drop.create({ data: { ...data, caseId: currentCase.id } });
    }

    const finalDrops = await db.drop.findMany({
      where: { caseId: currentCase.id },
      orderBy: { createdAt: "asc" },
    });
    const idsToDelete = finalDrops
      .filter((drop) => !definitions.some((definition) => definition.name === drop.name))
      .map((drop) => drop.id);

    if (idsToDelete.length) {
      await db.drop.deleteMany({
        where: { caseId: currentCase.id, id: { in: idsToDelete } },
      });
    }
  }
}

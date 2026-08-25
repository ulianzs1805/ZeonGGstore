import { Environment, Prisma, PrismaClient } from "@prisma/client";

export const SYSTEM_DROPS = [
  { name: "AKR Necromancer", rarity: "LEGENDARY", image: "/skins/akr-necromancer.png", probability: 55, price: 220 },
  { name: "G22 Monster", rarity: "EPIC", image: "/skins/g22-monster.png", probability: 20, price: 150 },
  { name: "AWM Winter Sport", rarity: "LEGENDARY", image: "/skins/awm-winter-sport.png", probability: 15, price: 14999 },
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

export const FABLE_DROPS = [
  { name: "M110 Cyber", rarity: "RARE", image: "/skins/fable/m110-cyber.png", probability: 8, price: 1 },
  { name: "F/S Tactical", rarity: "RARE", image: "/skins/fable/fs-tactical.png", probability: 8, price: 0.9 },
  { name: "Desert Eagle Ace", rarity: "RARE", image: "/skins/fable/desert-eagle-ace.png", probability: 8, price: 1.17 },
  { name: "G22 Starfall", rarity: "RARE", image: "/skins/fable/g22-starfall.png", probability: 8, price: 1.09 },
  { name: "FNFL Tactical", rarity: "EPIC", image: "/skins/fable/fnfl-tactical.png", probability: 8, price: 4.55 },
  { name: "UMP45 Cerberus", rarity: "EPIC", image: "/skins/fable/ump45-cerberus.png", probability: 8, price: 4.8 },
  { name: "USP Pisces", rarity: "EPIC", image: "/skins/fable/usp-pisces.png", probability: 7, price: 4.84 },
  { name: "MP7 Lich", rarity: "LEGENDARY", image: "/skins/fable/mp7-lich.png", probability: 7, price: 31.49 },
  { name: "M4 Lizard", rarity: "LEGENDARY", image: "/skins/fable/m4-lizard.png", probability: 7, price: 32 },
  { name: "Tec-9 Fable", rarity: "LEGENDARY", image: "/skins/fable/tec9-fable.png", probability: 7, price: 32 },
  { name: "F/S Venom", rarity: "ARCANE", image: "/skins/fable/fs-venom.png", probability: 6, price: 161 },
  { name: "M4 Samurai", rarity: "ARCANE", image: "/skins/fable/m4-samurai.png", probability: 6, price: 125 },
  { name: "Butterfly Starfall", rarity: "ARCANE", image: "/skins/fable/butterfly-starfall.png", probability: 3, price: 2000 },
  { name: "Butterfly Black Window", rarity: "ARCANE", image: "/skins/fable/butterfly-black-window.png", probability: 3, price: 2175 },
  { name: "Butterfly Legacy", rarity: "ARCANE", image: "/skins/fable/butterfly-legacy.png", probability: 3, price: 2450 },
  { name: "Butterfly Dragon Glass", rarity: "ARCANE", image: "/skins/fable/butterfly-dragon-glass.png", probability: 3, price: 2498 },
] as const;

export const PROTECTED_COLLECTION_SLUGS = new Set(["furious", "fable"]);
export function isProtectedCollection(slug: string) { return PROTECTED_COLLECTION_SLUGS.has(slug); }
const LEGACY_FURIOUS_DROP_NAMES = ["AKR Necromancer", "G22 Monster", "M4 Samurai", "AWM Winter Sport"] as const;
let syncPromise: Promise<void> | null = null;
type CatalogDb = PrismaClient | Prisma.TransactionClient;

export function ensureSystemCatalog(prisma: PrismaClient) {
  syncPromise ??= (async () => { await ensureFableCase(prisma); await syncCatalog(prisma); await enforceFableExclusiveM4(prisma); })().catch((error) => { syncPromise = null; throw error; });
  return syncPromise;
}
async function ensureFableCase(db: CatalogDb) {
  const existing = await db.case.findUnique({ where: { slug: "fable" } });
  if (existing) return;
  const owner = await db.case.findFirst({ where: { environment: Environment.SYSTEM }, select: { createdById: true }, orderBy: { createdAt: "asc" } });
  if (!owner) return;
  await db.case.create({ data: { slug: "fable", name: "Fable", description: "Fable collection", image: "/cases/fable.png", price: 100, environment: Environment.SYSTEM, probabilityMode: "MANUAL", isActive: true, createdById: owner.createdById } });
}
function definitionsForSlug(slug: string) { if (slug === "furious") return FURIOUS_DROPS; if (slug === "fable") return FABLE_DROPS; return SYSTEM_DROPS; }
async function syncCatalog(db: CatalogDb) {
  const cases = await db.case.findMany({ where: { environment: Environment.SYSTEM, isActive: true }, include: { drops: { orderBy: { createdAt: "asc" } } } });
  for (const currentCase of cases) {
    if (currentCase.slug === "furious") await db.drop.deleteMany({ where: { caseId: currentCase.id, name: { in: [...LEGACY_FURIOUS_DROP_NAMES] } } });
    const protectedCollection = isProtectedCollection(currentCase.slug);
    const targetProbabilityMode = protectedCollection ? "MANUAL" : "DYNAMIC";
    if (currentCase.probabilityMode !== targetProbabilityMode) await db.case.update({ where: { id: currentCase.id }, data: { probabilityMode: targetProbabilityMode } });
    const definitions = definitionsForSlug(currentCase.slug);
    const existingDrops = await db.drop.findMany({ where: { caseId: currentCase.id }, orderBy: { createdAt: "asc" } });
    const reusable = existingDrops.filter((drop) => !definitions.some((definition) => definition.name === drop.name));
    const reusableIds = new Set(reusable.map((drop) => drop.id));
    const canonicalByName = new Map<string, string>();
    for (const definition of definitions) {
      const existingByName = existingDrops.find((drop) => drop.name === definition.name);
      // M4 Samurai is a locked ZeonGGStore price. Other protected drops keep their admin-set price.
      const price = protectedCollection && existingByName && definition.name !== "M4 Samurai" ? existingByName.price : definition.price;
      const data = { name: definition.name, rarity: definition.rarity, image: definition.image, probability: definition.probability, price, environment: Environment.SYSTEM };
      if (existingByName) {
        await db.drop.update({ where: { id: existingByName.id }, data });
        await db.inventoryItem.updateMany({ where: { itemId: existingByName.id, soldAt: null }, data: { name: definition.name, rarity: definition.rarity, image: definition.image, price } });
        canonicalByName.set(definition.name, existingByName.id);
        continue;
      }
      const reusableDrop = reusable.find((drop) => reusableIds.has(drop.id));
      if (reusableDrop) {
        reusableIds.delete(reusableDrop.id);
        await db.drop.update({ where: { id: reusableDrop.id }, data });
        await db.inventoryItem.updateMany({ where: { itemId: reusableDrop.id, soldAt: null }, data: { name: definition.name, rarity: definition.rarity, image: definition.image, price } });
        canonicalByName.set(definition.name, reusableDrop.id);
        continue;
      }
      const created = await db.drop.create({ data: { ...data, caseId: currentCase.id } });
      canonicalByName.set(definition.name, created.id);
    }
    for (const definition of definitions) {
      const canonicalId = canonicalByName.get(definition.name); if (!canonicalId) continue;
      const duplicates = await db.drop.findMany({ where: { caseId: currentCase.id, name: definition.name, id: { not: canonicalId } }, select: { id: true } });
      for (const duplicate of duplicates) { const canonical = definitions.find((item) => item.name === definition.name)!; const storedCanonical = await db.drop.findUnique({ where: { id: canonicalId }, select: { price: true } }); await db.inventoryItem.updateMany({ where: { itemId: duplicate.id }, data: { itemId: canonicalId, name: canonical.name, rarity: canonical.rarity, image: canonical.image, price: storedCanonical?.price ?? canonical.price } }); await db.drop.delete({ where: { id: duplicate.id } }); }
    }
    const finalDrops = await db.drop.findMany({ where: { caseId: currentCase.id }, orderBy: { createdAt: "asc" } });
    const idsToDelete = finalDrops.filter((drop) => !definitions.some((definition) => definition.name === drop.name)).map((drop) => drop.id);
    if (idsToDelete.length) await db.drop.deleteMany({ where: { caseId: currentCase.id, id: { in: idsToDelete } } });
  }
}
async function enforceFableExclusiveM4(db: CatalogDb) {
  const fable = await db.case.findUnique({ where: { slug: "fable" }, include: { drops: true } }); if (!fable) return;
  const canonical = fable.drops.find((drop) => drop.name === "M4 Samurai"); if (!canonical) return;
  const foreign = await db.drop.findMany({ where: { name: "M4 Samurai", caseId: { not: canonical.caseId } }, select: { id: true } });
  for (const duplicate of foreign) { await db.inventoryItem.updateMany({ where: { itemId: duplicate.id }, data: { itemId: canonical.id, name: canonical.name, rarity: canonical.rarity, image: canonical.image, price: 125, caseId: fable.id } }); await db.drop.delete({ where: { id: duplicate.id } }); }
}

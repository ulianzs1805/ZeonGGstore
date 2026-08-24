import { Environment, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const cases = [
  { slug: "fable", name: "Fable Case", description: "Fable collection case", image: "/cases/fable-case.png", price: 100 },
  { slug: "chameleon", name: "Chameleon Case", description: "Chameleon collection case", image: "/cases/chameleon-case.png", price: 250 },
  { slug: "furious", name: "Furious Case", description: "Furious collection case", image: "/cases/furious-case.png", price: 500 },
  { slug: "empire", name: "Empire Case", description: "Empire collection case", image: "/cases/empire-case.png", price: 1000 },
] as const;

const drops = [
  { name: "AKR Necromancer", rarity: "LEGENDARY", image: "/skins/akr-necromancer.png", probability: 55, price: 220 },
  { name: "G22 Monster", rarity: "EPIC", image: "/skins/g22-monster.png", probability: 20, price: 160 },
  { name: "AWM Winter Sport", rarity: "LEGENDARY", image: "/skins/awm-winter-sport.png", probability: 15, price: 7000 },
  { name: "M4 Samurai", rarity: "ARCANE", image: "/skins/fable/m4-samurai.png", probability: 10, price: 120 },
] as const;

const furiousDrops = [
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

const legacyFuriousDropNames = ["AKR Necromancer", "G22 Monster", "M4 Samurai", "AWM Winter Sport"] as const;

async function main() {
  const dev = await prisma.user.upsert({ where: { email: "wystley6@gmail.com" }, update: { role: Role.NPN1_DEV }, create: { email: "wystley6@gmail.com", name: "Zeon Dev", role: Role.NPN1_DEV, balance: 10000 } });
  for (const item of cases) {
    const caseDrops = item.slug === "furious" ? furiousDrops : drops;
    const existing = await prisma.case.findUnique({ where: { slug: item.slug }, include: { drops: { orderBy: { createdAt: "asc" } } } });
    if (item.slug === "furious" && existing) await prisma.drop.deleteMany({ where: { caseId: existing.id, name: { in: [...legacyFuriousDropNames] } } });
    const existingDrops = existing?.drops.filter((drop) => !legacyFuriousDropNames.includes(drop.name as typeof legacyFuriousDropNames[number]));
    const currentCase = existing ?? await prisma.case.create({ data: { ...item, environment: Environment.SYSTEM, probabilityMode: "DYNAMIC", createdById: dev.id, drops: { create: caseDrops.map((drop) => ({ ...drop, environment: Environment.SYSTEM })) } } });
    for (const [index, drop] of caseDrops.entries()) {
      const currentDrop = existingDrops?.[index];
      const data = { name: drop.name, rarity: drop.rarity, image: drop.image, price: drop.price, probability: drop.probability, environment: Environment.SYSTEM };
      if (currentDrop) await prisma.drop.update({ where: { id: currentDrop.id }, data });
      else await prisma.drop.create({ data: { ...data, caseId: currentCase.id } });
    }
    if (item.slug === "furious" && existing && existingDrops && existingDrops.length > caseDrops.length) await prisma.drop.deleteMany({ where: { caseId: currentCase.id, id: { in: existingDrops.slice(caseDrops.length).map((drop) => drop.id) } } });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withFinalProbabilities } from "@/lib/price-weighted-chances";
import { ensureSystemCatalog } from "@/lib/system-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FABLE_IMAGE_BY_NAME: Record<string, string> = {
  "M110 Cyber": "/skins/fable/m110-cyber.png",
  "F/S Tactical": "/skins/fable/fs-tactical.png",
  "Desert Eagle Ace": "/skins/fable/desert-eagle-ace.png",
  "G22 Starfall": "/skins/fable/g22-starfall.png",
  "FNFL Tactical": "/skins/fable/fnfl-tactical.png",
  "UMP45 Cerberus": "/skins/fable/ump45-cerberus.png",
  "USP Pisces": "/skins/fable/usp-pisces.png",
  "MP7 Lich": "/skins/fable/mp7-lich.png",
  "M4 Lizard": "/skins/fable/m4-lizard.png",
  "Tec-9 Fable": "/skins/fable/tec9-fable.png",
  "F/S Venom": "/skins/fable/fs-venom.png",
  "M4 Samurai": "/skins/fable/m4-samurai.png",
  "Butterfly Starfall": "/skins/fable/butterfly-starfall.png",
  "Butterfly Black Window": "/skins/fable/butterfly-black-window.png",
  "Butterfly Legacy": "/skins/fable/butterfly-legacy.png",
  "Butterfly Dragon Glass": "/skins/fable/butterfly-dragon-glass.png",
};

function normalizeCaseDropImage(caseSlug: string, drop: { name: string; image: string }) {
  if (caseSlug !== "fable") return drop.image;
  const canonical = FABLE_IMAGE_BY_NAME[drop.name];
  return canonical ? `${canonical}?v=fable-png-v3` : drop.image;
}

export async function GET() {
  try {
    try {
      await ensureSystemCatalog(prisma);
    } catch (catalogError) {
      console.error("GET /api/cases catalog sync failed; continuing with existing cases", catalogError);
    }

    const cases = await prisma.case.findMany({
      where: { isActive: true, environment: "SYSTEM" },
      include: { drops: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      {
        cases: cases.map((item) => {
          const drops = withFinalProbabilities(item.drops, item.probabilityMode).map((drop) => ({
            ...drop,
            image: normalizeCaseDropImage(item.slug, drop),
          }));
          const seen = new Set<string>();
          const uniqueDrops = drops.filter((drop) => {
            const key = `${drop.name.trim().toLowerCase()}|${drop.image.trim()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return { ...item, drops: uniqueDrops };
        }),
      },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  } catch (error) {
    console.error("GET /api/cases failed", error);
    return NextResponse.json(
      { error: "Failed to load cases", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

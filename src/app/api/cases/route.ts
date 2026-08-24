import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withFinalProbabilities } from "@/lib/price-weighted-chances";
import { ensureSystemCatalog } from "@/lib/system-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
          const drops = withFinalProbabilities(item.drops, item.probabilityMode);
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
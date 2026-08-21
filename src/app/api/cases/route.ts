import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withFinalProbabilities } from "@/lib/price-weighted-chances";
import { ensureSystemCatalog } from "@/lib/system-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSystemCatalog(prisma);

    // Public listing: only show SYSTEM/production cases.
    const cases = await prisma.case.findMany({
      where: { isActive: true, environment: "SYSTEM" },
      include: {
        drops: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      {
        cases: cases.map((item) => ({
          ...item,
          drops: withFinalProbabilities(item.drops, item.probabilityMode),
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/cases failed", error);

    return NextResponse.json(
      {
        error: "Failed to load cases",
        message: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}

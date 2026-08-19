import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withFinalProbabilities } from "@/lib/price-weighted-chances";

export async function GET() {
  // Public listing: only show SYSTEM/production cases
  const cases = await prisma.case.findMany({ where: { isActive: true, environment: "SYSTEM" }, include: { drops: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ cases: cases.map((item) => ({ ...item, drops: withFinalProbabilities(item.drops, item.probabilityMode) })) });
}
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ensureSystemCatalog } from "@/lib/system-catalog";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

    await ensureSystemCatalog(prisma);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.freeCaseGrant.findFirst({
        where: { userId: user.id, sourcePromoId: "WELCOME_NEW_PLAYER" },
        include: { case: { select: { id: true, slug: true, name: true, image: true, price: true } } },
        orderBy: { createdAt: "asc" },
      });
      if (existing) return existing.case;

      const cases = await tx.case.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, name: true, image: true, price: true },
      });
      if (!cases.length) return null;

      const selected = cases[Math.floor(Math.random() * cases.length)];
      await tx.freeCaseGrant.create({
        data: { userId: user.id, caseId: selected.id, sourcePromoId: "WELCOME_NEW_PLAYER" },
      });
      return selected;
    });

    return NextResponse.json({ case: result });
  } catch (error) {
    console.error("GET /api/welcome-case failed", error);
    return NextResponse.json({ error: "Не удалось подготовить приветственный подарок" }, { status: 500 });
  }
}

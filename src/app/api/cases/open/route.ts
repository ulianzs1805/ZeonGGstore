import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { validateChances } from "@/lib/economy-guard";
import { withFinalProbabilities } from "@/lib/price-weighted-chances";
import { ensureSystemCatalog } from "@/lib/system-catalog";

function pickDrop<T extends { probability: number }>(drops: T[]): T {
  const point = (randomInt(0, 1000000) / 1000000) * 100;
  let remaining = point;
  for (const drop of drops) {
    remaining -= drop.probability;
    if (remaining <= 0) return drop;
  }
  return drops[drops.length - 1];
}

type OpenResult = {
  balance: number;
  item: Awaited<ReturnType<typeof prisma.inventoryItem.create>> | null;
  operation: Awaited<ReturnType<typeof prisma.operation.create>>;
  drop: Awaited<ReturnType<typeof prisma.drop.findFirst>> extends infer DropResult ? Exclude<DropResult, null> : never;
  case: Awaited<ReturnType<typeof prisma.case.findFirst>>;
  replay?: boolean;
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

    await ensureSystemCatalog(prisma);

    const body = await request.json().catch(() => null) as { caseId?: unknown; preview?: unknown; idempotencyKey?: unknown } | null;
    const requestedCaseId = typeof body?.caseId === "string" ? body.caseId : "";
    const preview = body?.preview === true;
    const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

    if (!requestedCaseId) return NextResponse.json({ error: "Не указан идентификатор кейса" }, { status: 400 });
    if (!preview && (!idempotencyKey || idempotencyKey.length > 120)) return NextResponse.json({ error: "Некорректный idempotency key." }, { status: 400 });

    const selectedCaseRecord = await prisma.case.findFirst({
      where: { OR: [{ id: requestedCaseId }, { slug: requestedCaseId }], isActive: true },
      include: { drops: { orderBy: { createdAt: "asc" } } },
    });

    const selectedCase = selectedCaseRecord ? {
      ...selectedCaseRecord,
      drops: withFinalProbabilities(selectedCaseRecord.drops, selectedCaseRecord.probabilityMode),
    } : null;

    if (!selectedCase || !selectedCaseRecord) return NextResponse.json({ error: "Кейс не найден или отключён" }, { status: 404 });
    if (!selectedCase.drops.length) return NextResponse.json({ error: "У кейса нет доступных предметов" }, { status: 409 });

    const finalProbabilityTotal = selectedCase.drops.reduce((total, drop) => total + drop.probability, 0);
    if (!Number.isFinite(finalProbabilityTotal) || !validateChances(selectedCase.drops.map((drop) => drop.probability))) {
      return NextResponse.json({ error: "У кейса некорректно настроены вероятности дропа." }, { status: 409 });
    }

    if (user.balance < selectedCase.price) {
      return NextResponse.json({ error: "Недостаточно Z-Coin для открытия этого кейса.", casePrice: selectedCase.price, balance: user.balance }, { status: 400 });
    }

    if (preview) return NextResponse.json({ casePrice: selectedCase.price, balance: user.balance, case: selectedCase });

    const result: OpenResult = await prisma.$transaction(async (transaction) => {
      const currentUser = await transaction.user.findUnique({ where: { id: user.id } });
      if (!currentUser) throw new Error("USER_NOT_FOUND");

      const existing = await transaction.operation.findUnique({ where: { idempotencyKey }, include: { item: true } });
      if (existing) {
        if (existing.userId !== user.id || existing.item?.caseId !== selectedCase.id) throw new Error("IDEMPOTENCY_CONFLICT");
        const replayDrop = selectedCase.drops.find((item) => item.id === existing.item?.itemId);
        if (!replayDrop) throw new Error("IDEMPOTENCY_CONFLICT");
        return { balance: currentUser.balance, item: existing.item, operation: existing, drop: replayDrop, case: selectedCase, replay: true };
      }

      if (currentUser.balance < selectedCase.price) throw new Error("INSUFFICIENT_BALANCE");

      const assignment = await transaction.forceDropAssignment.findFirst({
        where: { targetUserId: user.id, caseId: selectedCase.id, status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });
      const assignedDrop = assignment ? selectedCase.drops.find((candidate) => candidate.id === assignment.dropId) : null;
      const drop = assignedDrop ?? pickDrop(selectedCase.drops);
      if (assignment && !assignedDrop) throw new Error("INVALID_FORCE_DROP_ASSIGNMENT");

      const updatedUser = await transaction.user.update({ where: { id: user.id }, data: { balance: { decrement: selectedCase.price } } });
      const item = await transaction.inventoryItem.create({ data: { userId: user.id, itemId: drop.id, caseId: selectedCase.id, name: drop.name, rarity: drop.rarity, image: drop.image, price: drop.price } });
      const operation = await transaction.operation.create({ data: { userId: user.id, type: "CASE_OPEN", label: selectedCase.name, itemId: item.id, amount: -selectedCase.price, status: "SUCCESS", idempotencyKey } });
      await transaction.transaction.create({ data: { userId: user.id, type: "CASE_OPEN", zCoinAmount: -selectedCase.price, status: "SUCCESS" } });

      if (assignment) {
        await transaction.forceDropAssignment.update({ where: { id: assignment.id }, data: { status: "CONSUMED", consumedAt: new Date() } });
        await transaction.auditLog.create({ data: {
          actorUserId: user.id, actorRole: user.role, actorAdminId: null, action: "FORCE_DROP_CONSUMED", targetType: "USER", targetId: user.id,
          metadata: JSON.stringify({ assignmentId: assignment.id, caseId: selectedCase.id, dropId: drop.id, inventoryItemId: item.id }), status: "SUCCESS",
        } });
      }

      return { balance: updatedUser.balance, item, operation, drop, case: selectedCase };
    });

    return NextResponse.json(result, { status: result.replay ? 200 : 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") return NextResponse.json({ error: "Недостаточно Z-Coin для открытия этого кейса." }, { status: 400 });
    if (error instanceof Error && error.message === "IDEMPOTENCY_CONFLICT") return NextResponse.json({ error: "Ключ запроса уже использован для другой операции." }, { status: 409 });
    if (error instanceof Error && error.message === "USER_NOT_FOUND") return NextResponse.json({ error: "Пользователь не найден" }, { status: 401 });
    if (error instanceof Error && error.message === "INVALID_FORCE_DROP_ASSIGNMENT") return NextResponse.json({ error: "Ожидающий Force Drop больше не принадлежит этому кейсу." }, { status: 409 });
    console.error("POST /api/cases/open failed", error);
    return NextResponse.json({ error: "Не удалось открыть кейс", message: error instanceof Error ? error.message : "Unknown server error" }, { status: 500 });
  }
}

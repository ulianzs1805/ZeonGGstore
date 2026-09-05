import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { validateChances } from "@/lib/economy-guard";
import { withFinalProbabilities } from "@/lib/price-weighted-chances";
import { ensureSystemCatalog } from "@/lib/system-catalog";

function pickDrop<T extends { probability: number }>(drops: T[]): T {
  const point = (randomInt(0, 1_000_000) / 1_000_000) * 100;
  let remaining = point;
  for (const drop of drops) {
    remaining -= drop.probability;
    if (remaining <= 0) return drop;
  }
  return drops[drops.length - 1];
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Необходим вход" }, { status: 401 });

    await ensureSystemCatalog(prisma);

    const body = await request.json().catch(() => null) as {
      caseId?: unknown;
      preview?: unknown;
      idempotencyKey?: unknown;
      quantity?: unknown;
    } | null;
    const requestedCaseId = typeof body?.caseId === "string" ? body.caseId : "";
    const preview = body?.preview === true;
    const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const quantity = Number.isInteger(body?.quantity) ? Number(body?.quantity) : 1;

    if (!requestedCaseId) return NextResponse.json({ error: "Не указан идентификатор кейса" }, { status: 400 });
    if (![1, 2, 3].includes(quantity)) return NextResponse.json({ error: "Можно открыть от 1 до 3 кейсов за раз." }, { status: 400 });
    if (!preview && (!idempotencyKey || idempotencyKey.length > 120)) {
      return NextResponse.json({ error: "Некорректный idempotency key." }, { status: 400 });
    }

    const record = await prisma.case.findFirst({
      where: { OR: [{ id: requestedCaseId }, { slug: requestedCaseId }], isActive: true },
      include: { drops: { orderBy: { createdAt: "asc" } } },
    });
    if (!record) return NextResponse.json({ error: "Кейс не найден или отключён" }, { status: 404 });

    const selectedCase = { ...record, drops: withFinalProbabilities(record.drops, record.probabilityMode) };
    if (!selectedCase.drops.length) return NextResponse.json({ error: "У кейса нет доступных предметов" }, { status: 409 });
    if (!validateChances(selectedCase.drops.map((d) => d.probability))) {
      return NextResponse.json({ error: "У кейса некорректно настроены вероятности дропа." }, { status: 409 });
    }

    if (preview) {
      const grant = quantity === 1 ? await prisma.freeCaseGrant.findFirst({
        where: { userId: user.id, caseId: selectedCase.id, consumedAt: null },
        select: { id: true },
      }) : null;
      return NextResponse.json({
        casePrice: selectedCase.price,
        totalPrice: selectedCase.price * quantity,
        balance: user.balance,
        freeOpenAvailable: Boolean(grant),
        case: selectedCase,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({ where: { id: user.id } });
      if (!currentUser) throw new Error("USER_NOT_FOUND");

      const existing = await tx.operation.findUnique({ where: { idempotencyKey }, include: { item: true } });
      if (existing) {
        if (existing.userId !== user.id || existing.item?.caseId !== selectedCase.id) throw new Error("IDEMPOTENCY_CONFLICT");
        const replayOperations = await tx.operation.findMany({
          where: { userId: user.id, item: { caseId: selectedCase.id }, OR: [{ idempotencyKey }, { idempotencyKey: { startsWith: `${idempotencyKey}:` } }] },
          include: { item: true },
          orderBy: { createdAt: "asc" },
          take: 3,
        });
        const replayItems = replayOperations.map((operation) => operation.item).filter(Boolean);
        const replayDrops = replayItems.map((item) => selectedCase.drops.find((drop) => drop.id === item!.itemId)).filter(Boolean);
        if (!replayItems.length || replayItems.length !== replayDrops.length) throw new Error("IDEMPOTENCY_CONFLICT");
        return {
          balance: currentUser.balance,
          items: replayItems,
          drops: replayDrops,
          item: replayItems[0],
          drop: replayDrops[0],
          replay: true,
          freeOpen: existing.type === "CASE_OPEN_PROMO",
        };
      }

      const grant = quantity === 1 ? await tx.freeCaseGrant.findFirst({
        where: { userId: user.id, caseId: selectedCase.id, consumedAt: null },
        orderBy: { createdAt: "asc" },
      }) : null;
      const totalPrice = selectedCase.price * quantity;

      if (!grant) {
        const charge = await tx.user.updateMany({
          where: { id: user.id, balance: { gte: totalPrice } },
          data: { balance: { decrement: totalPrice } },
        });
        if (charge.count !== 1) throw new Error("INSUFFICIENT_BALANCE");
      }

      const assignments = await tx.forceDropAssignment.findMany({
        where: { targetUserId: user.id, caseId: selectedCase.id, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: quantity,
      });
      const drops = [] as typeof selectedCase.drops[number][];
      for (let index = 0; index < quantity; index += 1) {
        const assignment = assignments[index];
        const assignedDrop = assignment ? selectedCase.drops.find((drop) => drop.id === assignment.dropId) : null;
        if (assignment && !assignedDrop) throw new Error("INVALID_FORCE_DROP_ASSIGNMENT");
        drops.push(assignedDrop ?? pickDrop(selectedCase.drops));
      }

      if (grant) {
        const claimed = await tx.freeCaseGrant.updateMany({
          where: { id: grant.id, userId: user.id, caseId: selectedCase.id, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        if (claimed.count !== 1) throw new Error("FREE_GRANT_RACE");
      }

      for (const assignment of assignments) {
        const claimed = await tx.forceDropAssignment.updateMany({
          where: { id: assignment.id, targetUserId: user.id, caseId: selectedCase.id, status: "PENDING", consumedAt: null },
          data: { status: "CONSUMED", consumedAt: new Date() },
        });
        if (claimed.count !== 1) throw new Error("FORCE_DROP_RACE");
      }

      const items = [] as Awaited<ReturnType<typeof tx.inventoryItem.create>>[];
      for (let index = 0; index < drops.length; index += 1) {
        const drop = drops[index];
        const item = await tx.inventoryItem.create({
          data: { userId: user.id, itemId: drop.id, caseId: selectedCase.id, name: drop.name, rarity: drop.rarity, image: drop.image, price: drop.price },
        });
        items.push(item);
        await tx.operation.create({
          data: {
            userId: user.id,
            type: grant ? "CASE_OPEN_PROMO" : "CASE_OPEN",
            label: quantity > 1 ? `${selectedCase.name} ×${quantity}` : selectedCase.name,
            itemId: item.id,
            amount: grant ? 0 : index === 0 ? -totalPrice : 0,
            status: "SUCCESS",
            idempotencyKey: index === 0 ? idempotencyKey : `${idempotencyKey}:${index}`,
          },
        });
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: grant ? "CASE_OPEN_PROMO" : "CASE_OPEN",
            zCoinAmount: grant ? 0 : index === 0 ? -totalPrice : 0,
            status: "SUCCESS",
          },
        });
      }

      const freshUser = await tx.user.findUnique({ where: { id: user.id }, select: { balance: true } });
      if (!freshUser) throw new Error("USER_NOT_FOUND");

      return {
        balance: freshUser.balance,
        items,
        drops,
        item: items[0],
        drop: drops[0],
        replay: false,
        freeOpen: Boolean(grant),
      };
    });

    return NextResponse.json(result, { status: result.replay ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INSUFFICIENT_BALANCE") return NextResponse.json({ error: "Недостаточно Z-Coin для открытия этого кейса." }, { status: 400 });
    if (message === "IDEMPOTENCY_CONFLICT") return NextResponse.json({ error: "Ключ запроса уже использован для другой операции." }, { status: 409 });
    if (message === "FREE_GRANT_RACE") return NextResponse.json({ error: "Бесплатное открытие уже используется. Повтори попытку." }, { status: 409 });
    if (message === "FORCE_DROP_RACE") return NextResponse.json({ error: "Force Drop уже используется другим открытием. Повтори попытку." }, { status: 409 });
    if (message === "USER_NOT_FOUND") return NextResponse.json({ error: "Пользователь не найден" }, { status: 401 });
    if (message === "INVALID_FORCE_DROP_ASSIGNMENT") return NextResponse.json({ error: "Ожидающий Force Drop больше не принадлежит этому кейсу." }, { status: 409 });
    console.error("POST /api/cases/open failed", error);
    return NextResponse.json({ error: "Не удалось открыть кейс", message: message || "Unknown server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";

const FORCE_DROP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const access = await requirePermission("FORCE_DROP");
  if (!access.user) return access.response;

  // NPN1_DEV is the system owner role. This role intentionally has no Force Drop
  // cooldown or pending-assignment cap, while all other roles remain protected.
  const unlimitedForceDrop = access.user.role === "NPN1_DEV";

  try {
    const body = await request.json().catch(() => null);
    const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
    const caseId = typeof body?.caseId === "string" ? body.caseId : "";
    const dropId = typeof body?.dropId === "string" ? body.dropId : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!targetUserId || !caseId || !dropId || reason.length < 5) {
      return NextResponse.json({ error: "Выберите пользователя, кейс, Drop и причину от 5 символов." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, email: true } });
    if (!target) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });

    const selectedCase = await prisma.case.findFirst({
      where: { OR: [{ id: caseId }, { slug: caseId }], isActive: true },
      select: { id: true, slug: true, name: true },
    });
    if (!selectedCase) return NextResponse.json({ error: "Активный кейс не найден." }, { status: 404 });

    const drop = await prisma.drop.findUnique({
      where: { id: dropId },
      select: { id: true, caseId: true, name: true, rarity: true, probability: true, price: true },
    });
    if (!drop) return NextResponse.json({ error: "Drop не найден. Обновите список кейсов и выберите Drop заново." }, { status: 404 });
    if (drop.caseId !== selectedCase.id) {
      return NextResponse.json({ error: "Выбранный Drop принадлежит другому кейсу. Обновите список и выберите Drop заново." }, { status: 409 });
    }

    if (!unlimitedForceDrop) {
      const cooldownSince = new Date(Date.now() - FORCE_DROP_COOLDOWN_MS);
      const recentAssignment = await prisma.forceDropAssignment.findFirst({
        where: { targetUserId: target.id, createdAt: { gte: cooldownSince } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (recentAssignment) {
        const retryAt = new Date(recentAssignment.createdAt.getTime() + FORCE_DROP_COOLDOWN_MS);
        return NextResponse.json({ error: "Для этого аккаунта Force Drop уже использовался. Повторно можно через 24 часа.", retryAt: retryAt.toISOString() }, { status: 429 });
      }

      const pending = await prisma.forceDropAssignment.findFirst({
        where: { targetUserId: target.id, caseId: selectedCase.id, status: "PENDING" },
        select: { id: true },
      });
      if (pending) return NextResponse.json({ error: "Для этого игрока и кейса уже есть ожидающий Force Drop." }, { status: 409 });
    }

    const assignment = await prisma.forceDropAssignment.create({
      data: {
        targetUserId: target.id,
        caseId: selectedCase.id,
        dropId: drop.id,
        assignedById: access.user.id,
        reason,
      },
    });

    await writeAuditLog({
      actorUserId: access.user.id,
      actorRole: access.user.role,
      action: "FORCE_DROP_ASSIGNED",
      targetType: "USER",
      targetId: target.id,
      metadata: { assignmentId: assignment.id, caseId: selectedCase.id, dropId: drop.id, reason, targetEmail: target.email, probability: drop.probability, unlimitedForceDrop },
      status: "SUCCESS",
    }).catch((auditError) => console.error("FORCE_DROP audit log failed", auditError));

    return NextResponse.json({ assignment, message: unlimitedForceDrop ? "Force Drop назначен без лимита NPN1_DEV." : "Drop назначен. Игрок получит его только после обычного открытия этого кейса." }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/force-drop failed", error);
    const detail = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: "Не удалось назначить Force Drop.", detail }, { status: 500 });
  }
}

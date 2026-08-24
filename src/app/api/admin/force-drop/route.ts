import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";

const FORCE_DROP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const access = await requirePermission("FORCE_DROP");
  if (!access.user) return access.response;

  try {
    const body = await request.json().catch(() => null);
    const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
    const caseId = typeof body?.caseId === "string" ? body.caseId : "";
    const dropId = typeof body?.dropId === "string" ? body.dropId : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!targetUserId || !caseId || !dropId || reason.length < 5) {
      return NextResponse.json({ error: "Выберите пользователя, кейс, Drop и причину от 5 символов." }, { status: 400 });
    }

    const [target, selectedCase, drop] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, email: true } }),
      prisma.case.findFirst({ where: { OR: [{ id: caseId }, { slug: caseId }], isActive: true }, select: { id: true, slug: true, name: true } }),
      prisma.drop.findUnique({ where: { id: dropId }, select: { id: true, caseId: true, name: true, rarity: true, probability: true, price: true } }),
    ]);

    if (!target) return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
    if (!selectedCase) return NextResponse.json({ error: "Активный кейс не найден." }, { status: 404 });
    if (!drop) return NextResponse.json({ error: "Drop не найден. Обновите список кейсов и выберите Drop заново." }, { status: 404 });
    if (drop.caseId !== selectedCase.id) return NextResponse.json({ error: "Выбранный Drop принадлежит другому кейсу. Обновите список и выберите Drop заново." }, { status: 409 });

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(91736422)`;

      const actorProfile = await tx.devProfile.findUnique({ where: { userId: access.user!.id }, select: { devId: true } });
      const cooldownSince = new Date(Date.now() - FORCE_DROP_COOLDOWN_MS);
      const recentAssignment = await tx.forceDropAssignment.findFirst({ where: { targetUserId: target.id, createdAt: { gte: cooldownSince } }, orderBy: { createdAt: "desc" } });
      if (recentAssignment) throw new Error(`FORCE_DROP_COOLDOWN:${recentAssignment.createdAt.toISOString()}`);

      const pending = await tx.forceDropAssignment.findFirst({ where: { targetUserId: target.id, caseId: selectedCase.id, status: "PENDING" } });
      if (pending) throw new Error("PENDING_FORCE_DROP_EXISTS");

      const assignment = await tx.forceDropAssignment.create({ data: { targetUserId: target.id, caseId: selectedCase.id, dropId: drop.id, assignedById: access.user!.id, reason } });

      await tx.auditLog.create({
        data: {
          actorUserId: access.user!.id,
          actorRole: access.user!.role,
          actorAdminId: actorProfile?.devId ?? null,
          action: "FORCE_DROP_ASSIGNED",
          targetType: "USER",
          targetId: target.id,
          metadata: JSON.stringify({ assignmentId: assignment.id, caseId: selectedCase.id, dropId: drop.id, reason, targetEmail: target.email, probability: drop.probability }),
          status: "SUCCESS",
        },
      });

      return assignment;
    });

    return NextResponse.json({ assignment: result, message: "Drop назначен. Игрок получит его только после обычного открытия этого кейса." }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("FORCE_DROP_COOLDOWN:")) {
      const createdAt = error.message.slice("FORCE_DROP_COOLDOWN:".length);
      const retryAt = new Date(new Date(createdAt).getTime() + FORCE_DROP_COOLDOWN_MS);
      await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "FORCE_DROP_COOLDOWN_BLOCKED", targetType: "USER", metadata: { retryAt: retryAt.toISOString() }, status: "FAILED" }).catch(() => null);
      return NextResponse.json({ error: "Для этого аккаунта Force Drop уже использовался. Повторно можно через 24 часа.", retryAt: retryAt.toISOString() }, { status: 429 });
    }
    if (error instanceof Error && error.message === "PENDING_FORCE_DROP_EXISTS") return NextResponse.json({ error: "Для этого игрока и кейса уже есть ожидающий Force Drop." }, { status: 409 });

    console.error("POST /api/admin/force-drop failed", error);
    const prismaCode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
    const detail = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: "Не удалось назначить Force Drop.", detail, code: prismaCode }, { status: 500 });
  }
}

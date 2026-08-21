import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";
import { ensureSystemCatalog } from "@/lib/system-catalog";
import { withFinalProbabilities } from "@/lib/price-weighted-chances";

const FORCE_DROP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const access = await requirePermission("FORCE_DROP");
  if (!access.user) return access.response;
  await ensureSystemCatalog(prisma);
  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  const caseId = typeof body?.caseId === "string" ? body.caseId : "";
  const dropId = typeof body?.dropId === "string" ? body.dropId : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!targetUserId || !caseId || !dropId || reason.length < 5) return NextResponse.json({ error: "Выберите пользователя, кейс, Drop и причину от 5 символов." }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  const selectedCaseRecord = await prisma.case.findFirst({ where: { OR: [{ id: caseId }, { slug: caseId }], isActive: true }, include: { drops: true } });
  const selectedCase = selectedCaseRecord ? { ...selectedCaseRecord, drops: withFinalProbabilities(selectedCaseRecord.drops, selectedCaseRecord.probabilityMode) } : null;
  const drop = selectedCase?.drops.find((item) => item.id === dropId);
  if (!target || !selectedCase || !drop) return NextResponse.json({ error: "Пользователь, кейс или Drop не найден." }, { status: 404 });
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    const actorProfile = await tx.devProfile.findUnique({ where: { userId: access.user!.id }, select: { devId: true } });
    const cooldownSince = new Date(Date.now() - FORCE_DROP_COOLDOWN_MS);
    const recentAssignment = await tx.forceDropAssignment.findFirst({ where: { targetUserId: target.id, createdAt: { gte: cooldownSince } }, orderBy: { createdAt: "desc" } });
    if (recentAssignment) throw new Error(`FORCE_DROP_COOLDOWN:${recentAssignment.createdAt.toISOString()}`);
    const pending = await tx.forceDropAssignment.findFirst({ where: { targetUserId: target.id, caseId: selectedCase.id, status: "PENDING" } });
    if (pending) throw new Error("PENDING_FORCE_DROP_EXISTS");
    const assignment = await tx.forceDropAssignment.create({ data: { targetUserId: target.id, caseId: selectedCase.id, dropId: drop.id, assignedById: access.user!.id, reason } });
    await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: actorProfile?.devId ?? null, action: "FORCE_DROP_ASSIGNED", targetType: "USER", targetId: target.id, metadata: JSON.stringify({ assignmentId: assignment.id, caseId: selectedCase.id, dropId: drop.id, reason, targetEmail: target.email, probability: drop.probability }), status: "SUCCESS" } });
    return assignment;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("FORCE_DROP_COOLDOWN:")) {
      const createdAt = error.message.slice("FORCE_DROP_COOLDOWN:".length);
      const retryAt = new Date(new Date(createdAt).getTime() + FORCE_DROP_COOLDOWN_MS);
      await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "FORCE_DROP_COOLDOWN_BLOCKED", targetType: "USER", targetId: target.id, metadata: { targetEmail: target.email, retryAt: retryAt.toISOString() }, status: "FAILED" });
      return NextResponse.json({ error: "Для этого аккаунта Force Drop уже использовался. Повторно можно через 24 часа.", retryAt: retryAt.toISOString() }, { status: 429 });
    }
    if (error instanceof Error && error.message === "PENDING_FORCE_DROP_EXISTS") return NextResponse.json({ error: "Для этого игрока и кейса уже есть ожидающий Force Drop." }, { status: 409 });
    return NextResponse.json({ error: "Не удалось назначить Force Drop." }, { status: 500 });
  }
  return NextResponse.json({ assignment: result, message: "Drop назначен. Игрок получит его только после обычного открытия этого кейса." }, { status: 201 });
}
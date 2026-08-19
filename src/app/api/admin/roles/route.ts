import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

function staffIdFor(user: { adminProfile: { adminId: string } | null; devProfile: { devId: string } | null }) {
  return user.adminProfile?.adminId ?? user.devProfile?.devId ?? null;
}

async function uniqueStaffId(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], kind: "ADMIN" | "DEV") {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const value = String(randomInt(100000, 1000000));
    const found = kind === "ADMIN" ? await tx.adminProfile.findUnique({ where: { adminId: value } }) : await tx.devProfile.findUnique({ where: { devId: value } });
    if (!found) return value;
  }
  throw new Error("STAFF_ID_GENERATION_FAILED");
}

export async function GET(request: Request) {
  const access = await requirePermission("ROLE_GRANT_ADMIN");
  if (!access.user) return access.response;
  const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
  if (search.length < 2) return NextResponse.json({ users: [] });
  const users = await prisma.user.findMany({ where: { OR: [{ email: { contains: search } }, { name: { contains: search } }, { id: { contains: search } }] }, include: { adminProfile: { select: { adminId: true } }, devProfile: { select: { devId: true } } }, take: 20 });
  return NextResponse.json({ users: users.map((user) => ({ id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, staffId: staffIdFor(user) })) });
}

export async function POST(request: Request) {
  const access = await requirePermission("ROLE_GRANT_ADMIN");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  const nextRole = body?.role === "USER" || body?.role === "ADMIN" || body?.role === "DEV" ? body.role : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!targetUserId || !nextRole || reason.length < 5) return NextResponse.json({ error: "Укажите пользователя, разрешённую роль и причину от 5 символов." }, { status: 400 });
  if (targetUserId === access.user.id) return NextResponse.json({ error: "Нельзя изменять собственную роль." }, { status: 403 });
  if (nextRole === "DEV" && access.user.role !== "NPN1_DEV") return NextResponse.json({ error: "Только NPN1_DEV может назначать DEV." }, { status: 403 });
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, include: { adminProfile: true, devProfile: true } });
  if (!target || target.role === "NPN1_DEV") return NextResponse.json({ error: "Пользователь не найден или системная роль защищена." }, { status: 404 });
  if (access.user.role === "DEV" && (target.role === "DEV" || nextRole === "DEV")) return NextResponse.json({ error: "DEV может изменять только USER и ADMIN." }, { status: 403 });
  const oldRole = target.role;
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: target.id }, data: { role: nextRole } });
    if (nextRole === "ADMIN") await tx.adminProfile.upsert({ where: { userId: target.id }, update: {}, create: { userId: target.id, adminId: await uniqueStaffId(tx, "ADMIN") } });
    if (nextRole === "DEV") await tx.devProfile.upsert({ where: { userId: target.id }, update: {}, create: { userId: target.id, devId: await uniqueStaffId(tx, "DEV") } });
    const actorAdminProfile = access.user!.role === "ADMIN"
      ? await tx.adminProfile.findUnique({ where: { userId: access.user!.id }, select: { adminId: true } })
      : null;
    const actorDevProfile = access.user!.role !== "ADMIN"
      ? await tx.devProfile.findUnique({ where: { userId: access.user!.id }, select: { devId: true } })
      : null;
    await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: actorAdminProfile?.adminId ?? actorDevProfile?.devId ?? null, action: nextRole === "USER" ? "ROLE_REVOKED" : oldRole === "USER" ? "ROLE_GRANTED" : "ROLE_CHANGED", targetType: "USER", targetId: target.id, metadata: JSON.stringify({ targetEmail: target.email, oldRole, newRole: nextRole, reason }), status: "SUCCESS" } });
    return updated;
  });
  return NextResponse.json({ user: result });
}
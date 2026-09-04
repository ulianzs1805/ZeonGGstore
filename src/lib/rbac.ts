import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export type Permission =
  | "CASE_CREATE" | "CASE_EDIT" | "DROP_EDIT" | "DROP_CHANCE_EDIT"
  | "SUPPORT_MANAGE" | "TRANSACTION_READ" | "USER_BALANCE_ADJUST"
  | "AUDIT_READ" | "ROLE_MANAGE" | "FORCE_DROP" | "ZCOIN_MANAGE"
  | "ROLE_GRANT_ADMIN" | "DEV_CONSOLE" | "USER_READ" | "CASE_STATUS"
  | "TESTER_CATALOG_MANAGE" | "SKIN_PRICE_MANAGE" | "WITHDRAWAL_MANAGE";

const permissionRoles: Record<Permission, Role[]> = {
  CASE_CREATE: ["ADMIN", "DEV", "NPN1_DEV"], CASE_EDIT: ["DEV", "NPN1_DEV"],
  DROP_EDIT: ["ADMIN", "DEV", "NPN1_DEV"], DROP_CHANCE_EDIT: ["DEV", "NPN1_DEV"],
  SUPPORT_MANAGE: ["ADMIN", "DEV", "NPN1_DEV"], TRANSACTION_READ: ["DEV", "NPN1_DEV"],
  USER_BALANCE_ADJUST: ["DEV", "NPN1_DEV"], AUDIT_READ: ["ADMIN", "DEV", "NPN1_DEV"],
  ROLE_MANAGE: ["NPN1_DEV"], FORCE_DROP: ["NPN1_DEV"], ZCOIN_MANAGE: ["DEV", "NPN1_DEV"],
  ROLE_GRANT_ADMIN: ["DEV", "NPN1_DEV"], DEV_CONSOLE: ["DEV", "NPN1_DEV"],
  USER_READ: ["ADMIN", "DEV", "NPN1_DEV"], CASE_STATUS: ["ADMIN", "DEV", "NPN1_DEV"],
  TESTER_CATALOG_MANAGE: ["TESTER", "DEV", "NPN1_DEV"], SKIN_PRICE_MANAGE: ["DEV", "NPN1_DEV"],
  WITHDRAWAL_MANAGE: ["ADMIN", "DEV", "NPN1_DEV"],
};

export function isRole(value: string | null | undefined, role: Role): boolean { return value === role; }
export async function requireAuth() { const user = await getCurrentUser(); if (!user) return { user: null, response: NextResponse.json({ error: "Необходим вход" }, { status: 401 }) }; return { user, response: null }; }
export async function requireRole(roles: Role[]) { const result = await requireAuth(); if (!result.user) return result; if (!roles.includes(result.user.role)) { await recordDenied(result.user.id, result.user.role, "ROLE_REQUIRED", roles.join(",")); return { user: null, response: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) }; } return result; }
export async function requirePermission(permission: Permission) { const result = await requireAuth(); if (!result.user) return result; if (!permissionRoles[permission].includes(result.user.role)) { await recordDenied(result.user.id, result.user.role, "PERMISSION_REQUIRED", permission); return { user: null, response: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) }; } return result; }
async function recordDenied(actorUserId: string, actorRole: Role, targetType: string, targetId: string) { try { await writeAuditLog({ actorUserId, actorRole, action: `${actorRole}_PERMISSION_DENIED`, targetType, targetId, status: "FAILED" }); } catch {} }
export async function requireNpn1Dev() { const result = await requireRole(["NPN1_DEV"]); if (!result.user) return result; const configuredEmail = process.env.ZEON_NPN1_DEV_EMAIL?.trim().toLowerCase(); if (!configuredEmail || result.user.email !== configuredEmail) return { user: null, response: NextResponse.json({ error: "Системный доступ не настроен" }, { status: 403 }) }; return result; }
export async function writeAuditLog(input: { actorUserId: string; actorRole: Role; action: string; targetType: string; targetId?: string; metadata?: Record<string, unknown>; status?: "SUCCESS" | "FAILED"; }) {
  const adminProfile = input.actorRole === "ADMIN" ? await prisma.adminProfile.findUnique({ where: { userId: input.actorUserId }, select: { adminId: true } }) : null;
  const devProfile = input.actorRole !== "ADMIN" ? await prisma.devProfile.findUnique({ where: { userId: input.actorUserId }, select: { devId: true } }) : null;
  const testerProfile = input.actorRole === "TESTER" ? await prisma.testerProfile.findUnique({ where: { userId: input.actorUserId }, select: { testerId: true } }) : null;
  return prisma.auditLog.create({ data: { actorUserId: input.actorUserId, actorRole: input.actorRole, actorAdminId: adminProfile?.adminId ?? devProfile?.devId ?? testerProfile?.testerId ?? null, action: input.action, targetType: input.targetType, targetId: input.targetId, metadata: JSON.stringify(input.metadata ?? {}), status: input.status ?? "SUCCESS" } });
}

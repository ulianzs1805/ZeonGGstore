import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET() {
  const access = await requirePermission("AUDIT_READ");
  if (!access.user) return access.response;
  const logs = await prisma.auditLog.findMany({
    where: access.user.role === "ADMIN" ? { actorUserId: access.user.id } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ logs });
}
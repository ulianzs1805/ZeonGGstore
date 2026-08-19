import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";

export async function GET() {
  const access = await requirePermission("TRANSACTION_READ");
  if (!access.user) return access.response;
  const transactions = await prisma.transaction.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "TRANSACTION_VIEWED", targetType: "TRANSACTION" });
  return NextResponse.json({ transactions });
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET(request: Request) {
  const access = await requirePermission("USER_READ");
  if (!access.user) return access.response;
  const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
  const users = await prisma.user.findMany({
    where: search.length >= 2 ? { OR: [{ email: { contains: search } }, { name: { contains: search } }, { id: { contains: search } }] } : undefined,
    include: { adminProfile: { select: { adminId: true } }, devProfile: { select: { devId: true } }, _count: { select: { inventoryItems: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ users: users.map((user) => ({ id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, balance: user.balance, inventoryCount: user._count.inventoryItems, createdAt: user.createdAt, staffId: user.adminProfile?.adminId ?? user.devProfile?.devId ?? null })) });
}
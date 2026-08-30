import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { resolveSkinImage } from "@/lib/skin-image";

const CASE_IMAGE = "/cases/CaseRecoceryUpgrade.jpeg";
const publicItem = (item: { id: string; name: string; rarity: string; image: string; price: number }) => ({ id: item.id, name: item.name, rarity: item.rarity, image: resolveSkinImage(item.name, item.image), price: Number(item.price) || 0 });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const op = await prisma.operation.findFirst({ where: { userId: user.id, type: "UPGRADE_RECOVERY_CASE", status: "OPEN" }, orderBy: { createdAt: "desc" } });
  if (!op) return NextResponse.json({ recoveryCase: null });
  let meta: { lostItemName?: string; lostItemImage?: string; lostItemRarity?: string; lostValue?: number } = {};
  try { meta = JSON.parse(op.label || "{}"); } catch {}
  return NextResponse.json({ recoveryCase: { id: op.id, image: CASE_IMAGE, ...meta } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { recoveryCaseId?: unknown; idempotencyKey?: unknown } | null;
  const recoveryCaseId = typeof body?.recoveryCaseId === "string" ? body.recoveryCaseId : "";
  const key = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 100) : "";
  if (!recoveryCaseId || !key) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  if (await prisma.operation.findUnique({ where: { idempotencyKey: key } })) return NextResponse.json({ error: "REPLAY" }, { status: 409 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const op = await tx.operation.findFirst({ where: { id: recoveryCaseId, userId: user.id, type: "UPGRADE_RECOVERY_CASE", status: "OPEN" } });
      if (!op) throw new Error("RECOVERY_CASE_NOT_FOUND");
      let meta: { lostItemName?: string; lostItemImage?: string; lostItemRarity?: string; lostValue?: number } = {};
      try { meta = JSON.parse(op.label || "{}"); } catch {}
      const lostValue = Number(meta.lostValue) || 0;
      if (lostValue <= 0) throw new Error("RECOVERY_VALUE_INVALID");
      const drops = await tx.drop.findMany({ where: { case: { environment: "SYSTEM", isActive: true }, price: { gte: lostValue * 0.45, lte: lostValue * 1.15 } }, orderBy: [{ price: "asc" }, { name: "asc" }], select: { id: true, name: true, rarity: true, image: true, price: true } });
      if (!drops.length) throw new Error("RECOVERY_POOL_EMPTY");
      const index = randomInt(drops.length);
      const target = drops[index];
      const item = await tx.inventoryItem.create({ data: { userId: user.id, itemId: target.id, name: target.name, rarity: target.rarity, image: target.image, price: target.price } });
      await tx.operation.update({ where: { id: op.id }, data: { status: "CONSUMED", itemId: item.id } });
      await tx.operation.create({ data: { userId: user.id, type: "UPGRADE_RECOVERY_REWARD", itemId: item.id, amount: Math.round(target.price), status: "SUCCESS", label: `Кейс отыгрыша → ${target.name}`, idempotencyKey: key } });
      return { recoveryCaseId: op.id, resultItem: publicItem(item), lostValue };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "RECOVERY_FAILED";
    return NextResponse.json({ error: code }, { status: code === "RECOVERY_CASE_NOT_FOUND" ? 404 : 400 });
  }
}

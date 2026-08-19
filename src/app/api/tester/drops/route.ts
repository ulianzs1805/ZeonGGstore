import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";
import { validateChances, validateDropPrice } from "@/lib/economy-guard";

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 80;
}

export async function POST(request: Request) {
  const access = await requirePermission("TESTER_CATALOG_MANAGE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null) as { caseId?: unknown; name?: unknown; rarity?: unknown; image?: unknown; price?: unknown; probability?: unknown } | null;
  const caseId = typeof body?.caseId === "string" ? body.caseId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rarity = typeof body?.rarity === "string" ? body.rarity.trim() : "";
  const image = typeof body?.image === "string" ? body.image.trim() : "";
  const price = typeof body?.price === "number" ? body.price : 0;
  const probability = typeof body?.probability === "number" ? body.probability : 0;
  if (!caseId || !validName(name)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  if (!validateDropPrice(price) || !Number.isFinite(probability) || probability <= 0) return NextResponse.json({ error: "Price must be positive and probability must be greater than zero" }, { status: 400 });
  const parent = await prisma.case.findUnique({ where: { id: caseId }, include: { drops: true } });
  if (!parent) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (parent.environment !== "TEST") return NextResponse.json({ error: "Cannot modify non-test case" }, { status: 403 });

  // create
  try {
    const created = await prisma.$transaction(async (tx) => {
      const d = await tx.drop.create({ data: { caseId, name, rarity, image, price, probability, environment: "TEST" } });
      await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: null, action: "TEST_DROP_CREATED", targetType: "DROP", targetId: d.id, metadata: JSON.stringify({ caseId }), status: "SUCCESS" } });
      return d;
    });
    return NextResponse.json({ drop: created }, { status: 201 });
  } catch (err) {
    await writeAuditLog({ actorUserId: access.user!.id, actorRole: access.user!.role, action: "TEST_DROP_CREATED", targetType: "DROP", metadata: { error: String(err) }, status: "FAILED" });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await requirePermission("TESTER_CATALOG_MANAGE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null);
  const dropId = typeof body?.dropId === "string" ? body.dropId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const price = typeof body?.price === "number" ? body.price : undefined;
  const probability = typeof body?.probability === "number" ? body.probability : undefined;
  if (!dropId) return NextResponse.json({ error: "dropId required" }, { status: 400 });
  const target = await prisma.drop.findUnique({ where: { id: dropId }, include: { case: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.environment !== "TEST" || target.case.environment !== "TEST") return NextResponse.json({ error: "Cannot modify non-test drop" }, { status: 403 });
  const data: { name?: string; price?: number; probability?: number } = {};
  if (name !== undefined) data.name = name;
  if (price !== undefined) {
    if (!validateDropPrice(price)) return NextResponse.json({ error: "Price must be a positive integer" }, { status: 400 });
    data.price = price;
  }
  if (probability !== undefined) data.probability = probability;
  if (probability !== undefined && (!Number.isFinite(probability) || probability <= 0)) return NextResponse.json({ error: "Probability must be greater than zero" }, { status: 400 });
  const siblingDrops = await prisma.drop.findMany({ where: { caseId: target.caseId }, select: { id: true, probability: true } });
  if (probability !== undefined && !validateChances(siblingDrops.map((drop) => drop.id === dropId ? probability : drop.probability))) return NextResponse.json({ error: "Probability total must equal 100" }, { status: 400 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.drop.update({ where: { id: dropId }, data });
      await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: null, action: "TEST_DROP_UPDATED", targetType: "DROP", targetId: dropId, metadata: JSON.stringify({ changes: Object.keys(data) }), status: "SUCCESS" } });
      return u;
    });
    return NextResponse.json({ drop: updated });
  } catch (err) {
    await writeAuditLog({ actorUserId: access.user!.id, actorRole: access.user!.role, action: "TEST_DROP_UPDATED", targetType: "DROP", metadata: { error: String(err) }, status: "FAILED" });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await requirePermission("TESTER_CATALOG_MANAGE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null);
  const dropId = typeof body?.dropId === "string" ? body.dropId : "";
  if (!dropId) return NextResponse.json({ error: "dropId required" }, { status: 400 });
  const target = await prisma.drop.findUnique({ where: { id: dropId }, include: { case: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.environment !== "TEST" || target.case.environment !== "TEST") return NextResponse.json({ error: "Cannot delete non-test drop" }, { status: 403 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.drop.delete({ where: { id: dropId } });
      await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: null, action: "TEST_DROP_DELETED", targetType: "DROP", targetId: dropId, metadata: JSON.stringify({ caseId: target.caseId }), status: "SUCCESS" } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await writeAuditLog({ actorUserId: access.user!.id, actorRole: access.user!.role, action: "TEST_DROP_DELETED", targetType: "DROP", metadata: { error: String(err) }, status: "FAILED" });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";
import { validateChances, validateDropPrice, validateRarity } from "@/lib/economy-guard";

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
  if (!caseId || !validName(name) || !validateRarity(rarity)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  if (!validateDropPrice(price) || !Number.isFinite(probability) || probability <= 0 || probability > 100) return NextResponse.json({ error: "Price must be positive and probability must be between 0 and 100" }, { status: 400 });

  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(91736424)`;
      const parent = await tx.case.findUnique({ where: { id: caseId }, include: { drops: { select: { probability: true } } } });
      if (!parent) throw new Error("CASE_NOT_FOUND");
      if (parent.environment !== "TEST") throw new Error("NON_TEST_CASE");
      if (!validateChances([...parent.drops.map((drop) => drop.probability), probability])) throw new Error("PROBABILITY_TOTAL");

      const d = await tx.drop.create({ data: { caseId, name, rarity, image, price, probability, environment: "TEST" } });
      await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: null, action: "TEST_DROP_CREATED", targetType: "DROP", targetId: d.id, metadata: JSON.stringify({ caseId }), status: "SUCCESS" } });
      return d;
    });
    return NextResponse.json({ drop: created }, { status: 201 });
  } catch (err) {
    const code = err instanceof Error ? err.message : "FAILED";
    if (code === "CASE_NOT_FOUND") return NextResponse.json({ error: "Case not found" }, { status: 404 });
    if (code === "NON_TEST_CASE") return NextResponse.json({ error: "Cannot modify non-test case" }, { status: 403 });
    if (code === "PROBABILITY_TOTAL") return NextResponse.json({ error: "Probability total must equal 100" }, { status: 400 });
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
  const rarity = typeof body?.rarity === "string" ? body.rarity.trim() : undefined;
  const price = typeof body?.price === "number" ? body.price : undefined;
  const probability = typeof body?.probability === "number" ? body.probability : undefined;
  if (!dropId) return NextResponse.json({ error: "dropId required" }, { status: 400 });
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(91736424)`;
      const target = await tx.drop.findUnique({ where: { id: dropId }, include: { case: true } });
      if (!target) throw new Error("NOT_FOUND");
      if (target.environment !== "TEST" || target.case.environment !== "TEST") throw new Error("NON_TEST_DROP");
      if (name !== undefined && !validName(name)) throw new Error("INVALID_NAME");
      if (rarity !== undefined && !validateRarity(rarity)) throw new Error("INVALID_RARITY");
      if (price !== undefined && !validateDropPrice(price)) throw new Error("INVALID_PRICE");
      if (probability !== undefined && (!Number.isFinite(probability) || probability <= 0 || probability > 100)) throw new Error("INVALID_PROBABILITY");
      const data: { name?: string; rarity?: string; price?: number; probability?: number } = {};
      if (name !== undefined) data.name = name;
      if (rarity !== undefined) data.rarity = rarity;
      if (price !== undefined) data.price = price;
      if (probability !== undefined) data.probability = probability;
      if (probability !== undefined) {
        const siblings = await tx.drop.findMany({ where: { caseId: target.caseId }, select: { id: true, probability: true } });
        if (!validateChances(siblings.map((drop) => drop.id === dropId ? probability : drop.probability))) throw new Error("PROBABILITY_TOTAL");
      }
      const u = await tx.drop.update({ where: { id: dropId }, data });
      await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: null, action: "TEST_DROP_UPDATED", targetType: "DROP", targetId: dropId, metadata: JSON.stringify({ changes: Object.keys(data) }), status: "SUCCESS" } });
      return u;
    });
    return NextResponse.json({ drop: updated });
  } catch (err) {
    const code = err instanceof Error ? err.message : "FAILED";
    const errors: Record<string, [string, number]> = {
      NOT_FOUND: ["Not found", 404], NON_TEST_DROP: ["Cannot modify non-test drop", 403], INVALID_NAME: ["Invalid name", 400], INVALID_RARITY: ["Invalid rarity", 400], INVALID_PRICE: ["Invalid price", 400], INVALID_PROBABILITY: ["Invalid probability", 400], PROBABILITY_TOTAL: ["Probability total must equal 100", 400],
    };
    if (errors[code]) return NextResponse.json({ error: errors[code][0] }, { status: errors[code][1] });
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
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(91736424)`;
      const target = await tx.drop.findUnique({ where: { id: dropId }, include: { case: true } });
      if (!target) throw new Error("NOT_FOUND");
      if (target.environment !== "TEST" || target.case.environment !== "TEST") throw new Error("NON_TEST_DROP");
      const count = await tx.drop.count({ where: { caseId: target.caseId } });
      if (count <= 1) throw new Error("LAST_DROP");
      const siblings = await tx.drop.findMany({ where: { caseId: target.caseId, id: { not: dropId } }, select: { probability: true } });
      if (!validateChances(siblings.map((drop) => drop.probability))) throw new Error("PROBABILITY_TOTAL");
      await tx.drop.delete({ where: { id: dropId } });
      await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: null, action: "TEST_DROP_DELETED", targetType: "DROP", targetId: dropId, metadata: JSON.stringify({ caseId: target.caseId }), status: "SUCCESS" } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : "FAILED";
    const errors: Record<string, [string, number]> = { NOT_FOUND: ["Not found", 404], NON_TEST_DROP: ["Cannot delete non-test drop", 403], LAST_DROP: ["A test case must keep at least one drop", 400], PROBABILITY_TOTAL: ["Remaining probabilities must total 100", 400] };
    if (errors[code]) return NextResponse.json({ error: errors[code][0] }, { status: errors[code][1] });
    await writeAuditLog({ actorUserId: access.user!.id, actorRole: access.user!.role, action: "TEST_DROP_DELETED", targetType: "DROP", metadata: { error: String(err) }, status: "FAILED" });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

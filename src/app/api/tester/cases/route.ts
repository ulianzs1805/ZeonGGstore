import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";
import { validateCasePrice, validateChances, validateDropPrice, validateRarity } from "@/lib/economy-guard";

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 3 && value.trim().length <= 80 && /^[\p{L}\p{N} ._'"-]+$/u.test(value.trim());
}

function makeSlug(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `test-case-${Date.now()}`;
}

type TesterDropInput = { name?: unknown; rarity?: unknown; image?: unknown; price?: unknown; probability?: unknown };

export async function GET() {
  const access = await requirePermission("TESTER_CATALOG_MANAGE");
  if (!access.user) return access.response;
  const cases = await prisma.case.findMany({ where: { environment: "TEST" }, include: { drops: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ cases });
}

export async function POST(request: Request) {
  const access = await requirePermission("TESTER_CATALOG_MANAGE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null) as { name?: unknown; description?: unknown; image?: unknown; price?: unknown; drops?: unknown; probabilityMode?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const image = typeof body?.image === "string" ? body.image.trim() : "";
  const price = typeof body?.price === "number" ? body.price : NaN;
  const drops = Array.isArray(body?.drops) ? body.drops as TesterDropInput[] : [];
  const probabilityMode = body?.probabilityMode === "DYNAMIC" ? "DYNAMIC" : "MANUAL";

  if (!validName(name)) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  if (!validateCasePrice(price)) return NextResponse.json({ error: "Case price is invalid" }, { status: 400 });
  const slug = makeSlug(name);
  const existing = await prisma.case.findFirst({ where: { OR: [{ name }, { slug }] } });
  if (existing) return NextResponse.json({ error: "Case name/slug exists" }, { status: 409 });

  const normalized = drops.map(d => ({
    name: typeof d.name === "string" ? d.name.trim() : "",
    rarity: typeof d.rarity === "string" ? d.rarity.trim() : "",
    image: typeof d.image === "string" ? d.image.trim() : "",
    price: typeof d.price === "number" ? d.price : NaN,
    probability: typeof d.probability === "number" ? d.probability : NaN,
  }));
  if (normalized.length === 0) return NextResponse.json({ error: "Add at least one drop" }, { status: 400 });
  if (
    normalized.some((drop) => !drop.name || !validateRarity(drop.rarity) || !validateDropPrice(drop.price))
    || !validateChances(normalized.map((drop) => drop.probability))
  ) {
    return NextResponse.json({ error: "Prices, rarities and probabilities are invalid; probabilities must total 100" }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.case.create({
        data: {
          slug,
          name,
          description,
          image: image || "/cases/default-case.png",
          price,
          probabilityMode,
          createdById: access.user!.id,
          environment: "TEST",
          drops: {
            create: normalized.map(d => ({
              name: d.name,
              rarity: d.rarity,
              image: d.image,
              price: d.price,
              probability: d.probability,
              environment: "TEST",
            })),
          },
        },
        include: { drops: true },
      });
      await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: null, action: "TEST_CASE_CREATED", targetType: "CASE", targetId: c.id, metadata: JSON.stringify({ drops: c.drops.length }), status: "SUCCESS" } });
      return c;
    });
    return NextResponse.json({ case: created }, { status: 201 });
  } catch (err) {
    await writeAuditLog({ actorUserId: access.user!.id, actorRole: access.user!.role, action: "TEST_CASE_CREATED", targetType: "CASE", metadata: { error: String(err) }, status: "FAILED" });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await requirePermission("TESTER_CATALOG_MANAGE");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null);
  const caseId = typeof body?.caseId === "string" ? body.caseId : "";
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : null;
  if (!caseId || isActive === null) return NextResponse.json({ error: "caseId and isActive required" }, { status: 400 });
  const target = await prisma.case.findUnique({ where: { id: caseId } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.environment !== "TEST") return NextResponse.json({ error: "Cannot modify non-test case" }, { status: 403 });
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.case.update({ where: { id: caseId }, data: { isActive } });
    await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: null, action: isActive ? "TEST_CASE_ACTIVATED" : "TEST_CASE_DEACTIVATED", targetType: "CASE", targetId: caseId, metadata: JSON.stringify({ oldValue: target.isActive, newValue: isActive }), status: "SUCCESS" } });
    return result;
  });
  return NextResponse.json({ case: updated });
}

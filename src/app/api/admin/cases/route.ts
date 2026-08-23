import { NextResponse } from "next/server";
import { Environment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, writeAuditLog } from "@/lib/rbac";
import { validateCasePrice, validateChances, validateDropPrice, validateRarity } from "@/lib/economy-guard";
import { ensureSystemCatalog } from "@/lib/system-catalog";
import { calculateFinalProbabilities, withFinalProbabilities } from "@/lib/price-weighted-chances";

type DropInput = { name?: unknown; rarity?: unknown; image?: unknown; price?: unknown; chance?: unknown; probability?: unknown };
const DEFAULT_ADMIN_CASE_PRICE = 199;

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 3 && value.trim().length <= 80 && /^[\p{L}\p{N} ._'"-]+$/u.test(value.trim());
}
function normalizeCaseName(value: string) { return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU"); }
function processedImage(value: string) {
  if (typeof value !== "string" || value.length < 12 || value.length > 1000) return false;
  const legacyUpload = /^\/uploads\/[a-z0-9-]+\/[a-f0-9-]+\.(?:png|jpg|jpeg|webp)$/i.test(value);
  if (legacyUpload) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /vercel-storage\.com$/i.test(url.hostname) && /^\/cases\/[a-z0-9-]+\/[a-f0-9-]+\.(?:png|jpg|jpeg|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}
function makeSlug(value: string) { return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `case-${Date.now()}`; }

export async function GET() {
  const access = await requirePermission("CASE_CREATE");
  if (!access.user) return access.response;
  await ensureSystemCatalog(prisma);
  const cases = await prisma.case.findMany({ where: access.user.role === "ADMIN" ? { createdById: access.user.id } : undefined, include: { drops: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ cases: cases.map((item) => ({ ...item, isCollectionLocked: item.environment === Environment.SYSTEM, drops: withFinalProbabilities(item.drops, item.probabilityMode) })) });
}

export async function POST(request: Request) {
  const access = await requirePermission("CASE_CREATE");
  if (!access.user) return access.response;
  await ensureSystemCatalog(prisma);

  const body = await request.json().catch(() => null) as { name?: unknown; description?: unknown; image?: unknown; price?: unknown; drops?: unknown; probabilityMode?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  const image = typeof body?.image === "string" ? body.image.trim() : "";
  const requestedPrice = typeof body?.price === "number" ? body.price : NaN;
  const drops = Array.isArray(body?.drops) ? body.drops as DropInput[] : [];
  const requestedProbabilityMode = body?.probabilityMode === "DYNAMIC" ? "DYNAMIC" : "MANUAL";
  // Ordinary admins are intentionally locked to automatic probabilities.
  // DEV/NPN1_DEV keep the ability to choose the mode for each case.
  const probabilityMode = access.user.role === "ADMIN" ? "DYNAMIC" : requestedProbabilityMode;

  if (!validName(name)) return NextResponse.json({ error: "Название кейса должно содержать от 3 до 80 символов." }, { status: 400 });
  if (!processedImage(image)) return NextResponse.json({ error: "Сначала загрузите изображение кейса через форму." }, { status: 400 });

  const price = access.user.role === "ADMIN" ? DEFAULT_ADMIN_CASE_PRICE : requestedPrice;
  if (!validateCasePrice(price)) return NextResponse.json({ error: "Некорректная цена кейса." }, { status: 400 });
  if (drops.length < 1) return NextResponse.json({ error: "Добавьте хотя бы один предмет в кейс." }, { status: 400 });

  const slug = makeSlug(name);
  const normalizedName = normalizeCaseName(name);
  const existingCases = await prisma.case.findMany({ select: { name: true, slug: true, environment: true } });
  const existing = existingCases.find((item) => normalizeCaseName(item.name) === normalizedName || item.slug === slug);
  if (existing) return NextResponse.json({ error: `Название «${name}» уже занято существующим кейсом и не может использоваться повторно.` }, { status: 409 });

  const normalizedDrops = drops.map((drop) => ({
    name: typeof drop.name === "string" ? drop.name.trim() : "",
    rarity: typeof drop.rarity === "string" ? drop.rarity.trim() : "",
    image: typeof drop.image === "string" ? drop.image.trim() : "",
    price: typeof drop.price === "number" ? drop.price : NaN,
    chance: typeof drop.probability === "number" ? drop.probability : typeof drop.chance === "number" ? drop.chance : NaN,
  }));

  if (normalizedDrops.some((drop) => !validName(drop.name) || !validateRarity(drop.rarity) || !processedImage(drop.image) || !validateDropPrice(drop.price))) {
    return NextResponse.json({ error: "Данные дропа не прошли проверку." }, { status: 400 });
  }

  const automaticSeed = normalizedDrops.map((drop, index) => ({ id: String(index), rarity: drop.rarity, price: drop.price, probability: 1 }));
  const automaticChances = calculateFinalProbabilities(automaticSeed, "DYNAMIC");
  const manualChances = normalizedDrops.map((drop) => drop.chance);
  const chances = probabilityMode === "DYNAMIC" ? automaticChances : manualChances;

  if (!validateChances(chances)) {
    return NextResponse.json({
      error: probabilityMode === "DYNAMIC"
        ? "Не удалось автоматически рассчитать вероятности. Проверьте цену и редкость каждого скина."
        : "Невозможно сохранить кейс. В ручном режиме сумма вероятностей должна быть равна 100%.",
    }, { status: 400 });
  }

  try {
    const adminProfile = await prisma.adminProfile.findUnique({ where: { userId: access.user.id }, select: { adminId: true } });
    const devProfile = await prisma.devProfile.findUnique({ where: { userId: access.user.id }, select: { devId: true } });
    const actorAdminId = adminProfile?.adminId ?? devProfile?.devId ?? null;

    const created = await prisma.$transaction(async (transaction) => {
      const createdCase = await transaction.case.create({
        data: {
          slug,
          name,
          description,
          image,
          price,
          probabilityMode,
          createdById: access.user.id,
          drops: {
            create: normalizedDrops.map((drop, index) => ({
              name: drop.name,
              rarity: drop.rarity,
              image: drop.image,
              price: drop.price,
              probability: probabilityMode === "DYNAMIC" ? 1 : chances[index],
            })),
          },
        },
        include: { drops: true },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: access.user.id,
          actorRole: access.user.role,
          actorAdminId,
          action: "CASE_CREATED",
          targetType: "CASE",
          targetId: createdCase.id,
          metadata: JSON.stringify({ name, drops: createdCase.drops.length, collectionLocked: false, probabilityMode }),
          status: "SUCCESS",
        },
      });
      return createdCase;
    });

    return NextResponse.json({ case: { ...created, drops: withFinalProbabilities(created.drops, probabilityMode) } }, { status: 201 });
  } catch (error) {
    await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "CASE_CREATED", targetType: "CASE", metadata: { error: String(error) }, status: "FAILED" });
    return NextResponse.json({ error: "Не удалось создать кейс." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await requirePermission("CASE_STATUS");
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null);
  const caseId = typeof body?.caseId === "string" ? body.caseId : "";
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : null;
  const probabilityMode = body?.probabilityMode === "DYNAMIC" || body?.probabilityMode === "MANUAL" ? body.probabilityMode : null;
  if (!caseId || (isActive === null && probabilityMode === null)) return NextResponse.json({ error: "Укажите caseId и изменение." }, { status: 400 });

  const target = await prisma.case.findUnique({ where: { id: caseId } });
  if (!target) return NextResponse.json({ error: "Кейс не найден." }, { status: 404 });
  if (access.user.role === "ADMIN" && target.createdById !== access.user.id) return NextResponse.json({ error: "ADMIN может менять статус только своих кейсов." }, { status: 403 });

  if (probabilityMode !== null) {
    const editAccess = await requirePermission("CASE_EDIT");
    if (!editAccess.user) return editAccess.response;
    if (access.user.role === "ADMIN" && probabilityMode !== "DYNAMIC") {
      return NextResponse.json({ error: "ADMIN использует только автоматический режим вероятностей." }, { status: 403 });
    }
    if (target.environment === Environment.SYSTEM) return NextResponse.json({ error: "Этот кейс является полноценной системной коллекцией. Его состав и режим вероятностей закреплены." }, { status: 403 });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.case.update({ where: { id: caseId }, data: { probabilityMode } });
      await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: null, action: "CASE_PROBABILITY_MODE_UPDATED", targetType: "CASE", targetId: caseId, metadata: JSON.stringify({ oldMode: target.probabilityMode, newMode: probabilityMode }), status: "SUCCESS" } });
      return result;
    });
    return NextResponse.json({ case: updated });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.case.update({ where: { id: caseId }, data: { isActive } });
    const adminProfile = access.user!.role === "ADMIN" ? await tx.adminProfile.findUnique({ where: { userId: access.user!.id }, select: { adminId: true } }) : null;
    const devProfile = access.user!.role !== "ADMIN" ? await tx.devProfile.findUnique({ where: { userId: access.user!.id }, select: { devId: true } }) : null;
    await tx.auditLog.create({ data: { actorUserId: access.user!.id, actorRole: access.user!.role, actorAdminId: adminProfile?.adminId ?? devProfile?.devId ?? null, action: isActive ? "CASE_ACTIVATED" : "CASE_DEACTIVATED", targetType: "CASE", targetId: caseId, metadata: JSON.stringify({ oldValue: target.isActive, newValue: isActive }), status: "SUCCESS" } });
    return result;
  });

  return NextResponse.json({ case: updated });
}

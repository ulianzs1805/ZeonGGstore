import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog } from "@/lib/rbac";

const CODE_RE = /^[A-Z0-9]{6,24}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TYPE = "FORTUNE_BYPASS_CODE";

function parse(label: string | null) { try { return JSON.parse(label || "{}"); } catch { return {}; } }
function generateCode() { return Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join(""); }

export async function GET() {
  const access = await requireRole(["ADMIN", "DEV", "NPN1_DEV"]);
  if (!access.user) return access.response;
  const rows = await prisma.operation.findMany({ where: { type: TYPE }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, label: true, createdAt: true, status: true } });
  return NextResponse.json({ codes: rows.map((row) => ({ id: row.id, ...parse(row.label), createdAt: row.createdAt, status: row.status })) });
}

export async function POST(request: Request) {
  const access = await requireRole(["ADMIN", "DEV", "NPN1_DEV"]);
  if (!access.user) return access.response;
  const body = await request.json().catch(() => null) as { code?: unknown; expiresHours?: unknown } | null;
  let code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const expiresHours = typeof body?.expiresHours === "number" ? body.expiresHours : Number(body?.expiresHours);
  if (!code) code = generateCode();
  if (!CODE_RE.test(code)) return NextResponse.json({ error: "Код: от 6 до 24 символов, только A-Z и 0-9." }, { status: 400 });
  if (!Number.isFinite(expiresHours) || expiresHours < 1 || expiresHours > 8760) return NextResponse.json({ error: "Срок действия: от 1 до 8760 часов." }, { status: 400 });
  const existing = await prisma.operation.findUnique({ where: { idempotencyKey: `fortune-bypass-code:${code}` }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Такой промокод уже существует." }, { status: 409 });
  const expiresAt = new Date(Date.now() + Math.floor(expiresHours) * 60 * 60 * 1000);
  const row = await prisma.operation.create({ data: { userId: access.user.id, type: TYPE, label: JSON.stringify({ code, expiresAt: expiresAt.toISOString(), oneUsePerAccount: true }), amount: 0, status: "ACTIVE", idempotencyKey: `fortune-bypass-code:${code}` }, select: { id: true, label: true, createdAt: true, status: true } });
  await writeAuditLog({ actorUserId: access.user.id, actorRole: access.user.role, action: "FORTUNE_BYPASS_CODE_CREATED", targetType: "FORTUNE_BYPASS_CODE", targetId: row.id, metadata: { code, expiresAt }, status: "SUCCESS" }).catch(() => null);
  return NextResponse.json({ ok: true, code, expiresAt, oneUsePerAccount: true }, { status: 201 });
}

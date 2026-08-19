import { NextResponse } from "next/server";
import { BETA_COOKIE_MAX_AGE, BETA_COOKIE_NAME, createBetaToken, isBetaCodeValid, isBetaConfigured } from "@/lib/beta-access";

export async function POST(request: Request) {
  if (!isBetaConfigured()) return NextResponse.json({ error: "Beta-доступ временно недоступен" }, { status: 503 });
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!isBetaCodeValid(code)) return NextResponse.json({ error: "Неверный Beta-код." }, { status: 403 });
  const token = createBetaToken();
  if (!token) return NextResponse.json({ error: "Beta-доступ временно недоступен" }, { status: 503 });
  const response = NextResponse.json({ ok: true, message: "Доступ разрешён." });
  response.cookies.set(BETA_COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: BETA_COOKIE_MAX_AGE });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(BETA_COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
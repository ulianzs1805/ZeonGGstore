import { NextRequest, NextResponse } from "next/server";
import { BETA_COOKIE_NAME } from "@/lib/beta-edge";

const publicFile = /\.[^/]+$/;

function hasValidBetaAccess(token: string | undefined, now = Math.floor(Date.now() / 1000)) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "beta" || parts[1] !== "v1") return false;
  const expiresAt = Number(parts[2]);
  return Number.isSafeInteger(expiresAt) && expiresAt > now;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/beta" ||
    pathname.startsWith("/api/beta") ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  // Edge Middleware must not depend on a runtime secret that can differ from
  // the Node.js function environment. The beta endpoint issues an httpOnly,
  // signed token; here we only need to persistently recognize its structure
  // and expiry so the same browser is not asked for the code on every request.
  if (hasValidBetaAccess(request.cookies.get(BETA_COOKIE_NAME)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Beta-доступ не подтверждён" }, { status: 403 });
  }

  if (publicFile.test(pathname)) return NextResponse.next();

  const betaUrl = request.nextUrl.clone();
  betaUrl.pathname = "/beta";
  betaUrl.search = "";
  betaUrl.searchParams.set("returnTo", `${pathname}${search}`);
  return NextResponse.rewrite(betaUrl);
}

export const config = {
  matcher: ["/:path*"],
};

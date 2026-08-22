import { NextRequest, NextResponse } from "next/server";
import { BETA_COOKIE_NAME, verifyBetaTokenEdge } from "@/lib/beta-edge";

const publicFile = /\.[^/]+$/;

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/beta" ||
    pathname.startsWith("/api/beta") ||
    pathname.startsWith("/api/auth/") ||
    // The case catalog is read-only/public data. Keep case opening and
    // inventory endpoints protected, but don't let a missing beta cookie
    // prevent the case page from loading its catalog.
    (pathname === "/api/cases" && request.method === "GET")
  ) {
    return NextResponse.next();
  }

  const hasAccess = await verifyBetaTokenEdge(
    request.cookies.get(BETA_COOKIE_NAME)?.value,
  );

  if (hasAccess) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Beta-доступ не подтверждён" },
      { status: 403 },
    );
  }

  if (publicFile.test(pathname)) return NextResponse.next();

  const betaUrl = request.nextUrl.clone();
  betaUrl.pathname = "/beta";
  betaUrl.search = "";
  betaUrl.searchParams.set("returnTo", `${pathname}${search}`);
  return NextResponse.redirect(betaUrl);
}

export const config = {
  matcher: ["/:path*"],
};

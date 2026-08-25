import { NextRequest, NextResponse } from "next/server";
import { BETA_COOKIE_NAME, verifyBetaTokenEdge } from "@/lib/beta-edge";

const publicFile = /\.[^/]+$/;

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const canonicalOrigin = process.env.NEXTAUTH_URL?.replace(/\/$/, "");

  // Keep the entire application on the same canonical origin. This is
  // important not only for OAuth state cookies, but also for the beta cookie:
  // cookies are host-bound, so opening a Vercel deployment alias would make a
  // previously confirmed beta session look unauthenticated.
  if (canonicalOrigin && request.nextUrl.origin !== canonicalOrigin) {
    const canonicalUrl = new URL(`${canonicalOrigin}${pathname}${search}`);
    return NextResponse.redirect(canonicalUrl, 307);
  }

  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/beta" ||
    pathname.startsWith("/api/beta/") ||
    (pathname === "/api/cases" && request.method === "GET")
  ) {
    return NextResponse.next();
  }

  const hasAccess = await verifyBetaTokenEdge(
    request.cookies.get(BETA_COOKIE_NAME)?.value,
  );

  if (hasAccess) return NextResponse.next();

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

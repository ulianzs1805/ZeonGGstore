import { NextRequest, NextResponse } from "next/server";
import { BETA_COOKIE_NAME, verifyBetaTokenEdge } from "@/lib/beta-edge";

const publicFile = /\.[^/]+$/;

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico" || pathname === "/beta" || pathname.startsWith("/api/beta") || pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (await verifyBetaTokenEdge(request.cookies.get(BETA_COOKIE_NAME)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Beta-доступ не подтверждён" }, { status: 403 });
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
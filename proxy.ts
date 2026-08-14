import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// Paths reachable without a browser session:
//  - the auth endpoints (you need them to log in / out / check session)
//  - the Home Assistant webhook, which authenticates itself with a per-user
//    token instead of a cookie (HA is not a browser).
function isPublic(pathname: string): boolean {
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/ha-webhook") return true;
  return false;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const userId = await verifySessionToken(req.cookies.get(COOKIE_NAME)?.value);

  // The login page is reachable logged-out; if already logged in, skip it.
  if (pathname === "/login") {
    if (userId) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (userId) return NextResponse.next();

  // API calls get a clean 401 so the client can react; pages redirect to login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

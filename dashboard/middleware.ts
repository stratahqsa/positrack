import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Server-side access gate (Consensus Rev #1).
 * Every route requires a valid signed session cookie EXCEPT /login and the
 * login route handler. Static assets and Next internals are excluded via the
 * matcher below, so no snapshot data is ever reachable unauthenticated.
 *
 * If ACCESS_CODE is unset we let requests through so the pages can render a
 * clear "ACCESS_CODE not configured" notice instead of hard-failing the app.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths: the login page + its handler, and the cron tick (self-
  // guarded by CRON_SECRET — Vercel Cron sends no session cookie).
  if (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/api/cron/refresh"
  ) {
    return NextResponse.next();
  }

  // Admin surface: /admin* pages + /api/admin/* need the ADMIN session
  // (separate ADMIN_CODE — the shared viewer PIN must not manage schedules).
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (pathname === "/admin/login" || pathname === "/api/admin/login") {
      return NextResponse.next();
    }
    const adminCode = process.env.ADMIN_CODE;
    if (!adminCode) return NextResponse.next(); // page renders a config notice
    const adminTok = req.cookies.get(ADMIN_COOKIE)?.value;
    if (await verifySessionToken(adminTok, adminCode)) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "admin session required" },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    // Misconfiguration: pages themselves surface the notice. Do not lock out.
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySessionToken(token, accessCode);
  if (ok) return NextResponse.next();

  // Unauthenticated → redirect to /login, preserving intended destination.
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") {
    url.searchParams.set("next", pathname + (req.nextUrl.search || ""));
  }
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * Run on everything except Next internals and obvious static files.
   * Note: this app exposes NO public API returning snapshot data — data is only
   * server-rendered inside gated pages — so there is nothing to leak past this.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
  ],
};

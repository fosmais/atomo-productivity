import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Only production navigations are canonicalized. Preview deployments and
  // API/OAuth callbacks retain their own origin for isolated testing.
  const hostname = request.nextUrl.hostname.toLowerCase();
  const pathname = request.nextUrl.pathname;
  const isNavigation = request.method === "GET" && request.headers.get("accept")?.includes("text/html");
  const isAppPage = pathname === "/" || pathname === "/login" || pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") || pathname === "/planos";
  if (
    process.env.VERCEL_ENV === "production" &&
    hostname.endsWith(".vercel.app") &&
    isNavigation &&
    isAppPage
  ) {
    const destination = request.nextUrl.clone();
    destination.protocol = "https:";
    destination.hostname = "www.myryra.com";
    destination.port = "";
    return NextResponse.redirect(destination, 308);
  }
  try {
    return await updateSession(request);
  } catch (cause) {
    // A session refresh failure happens before the route handler runs.
    // API clients must receive JSON rather than a Next.js HTML error page.
    console.error("[auth-proxy] session_refresh_failed", {
      path: pathname.startsWith("/api/") ? "api" : "page",
      category: cause instanceof Error ? cause.name : "unknown",
    });
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Não foi possível verificar sua sessão. Tente novamente em instantes." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    // An expired/revoked refresh token should not crash a protected page.
    // Redirect only protected dashboard navigations; never redirect login or
    // API requests, which would create loops or break JSON clients.
    const authCode = cause && typeof cause === "object" && "code" in cause
      ? (cause as { code?: unknown }).code : undefined;
    if (authCode === "refresh_token_not_found" &&
        (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("session", "expired");
      return NextResponse.redirect(loginUrl, 307);
    }
    throw cause;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/tasks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

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
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/tasks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

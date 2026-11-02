import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

/** Fail-closed OAuth callback until encrypted per-user token persistence is deployed. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/dashboard?todoist=setup_pending", request.url));
  const cookie = request.cookies.get("myryra_todoist_oauth_state")?.value;
  response.cookies.delete({ name: "myryra_todoist_oauth_state", path: "/api/todoist" });
  if (!cookie || !request.nextUrl.searchParams.get("state")) return response;
  try {
    const parsed: unknown = JSON.parse(cookie);
    if (!parsed || typeof parsed !== "object") return response;
    const record = parsed as Record<string, unknown>;
    const returned = request.nextUrl.searchParams.get("state")!;
    if (typeof record.state !== "string" || typeof record.userId !== "string") return response;
    const a = Buffer.from(returned);
    const b = Buffer.from(record.state);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return response;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== record.userId) return response;
    // Never exchange authorization codes or persist tokens before the secure
    // database migration and complete consent flow are available.
    return response;
  } catch {
    return response;
  }
}

import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const emailOtpTypes: EmailOtpType[] = [
  "email",
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
];

function isEmailOtpType(value: string): value is EmailOtpType {
  return emailOtpTypes.some((emailOtpType) => emailOtpType === value);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (
    !tokenHash ||
    !type ||
    !isEmailOtpType(type)
  ) {
    return NextResponse.redirect(
      new URL("/login?error=confirm", url.origin)
    );
  }

  const response = NextResponse.redirect(new URL(type === "recovery" ? "/auth/reset-password" : "/dashboard", url.origin));
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => {
        request.cookies.set(name, value);
        response.cookies.set(name, value, options);
      }),
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=confirm", url.origin)
    );
  }

  return response;
}
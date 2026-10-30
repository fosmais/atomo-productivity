import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=confirm", url.origin)
    );
  }

  return NextResponse.redirect(
    new URL(type === "recovery" ? "/auth/reset-password" : "/dashboard", url.origin)
  );
}
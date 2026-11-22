import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";


const MAX_BATCH = 50;
const MAX_ATTEMPTS = 3;

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.MYRYRA_NOTIFICATION_WORKER_SECRET;
  const provided = request.headers.get("authorization");
  if (!configuredSecret || !provided || provided !== `Bearer ${configuredSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Production stays read-only. Preview reservation requires explicit opt-in.
  const previewClaimRequested = request.nextUrl.searchParams.get("mode") === "claim-preview";
  if (previewClaimRequested && (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.MYRYRA_FINANCE_CLAIM_PREVIEW_ENABLED !== "true"
  )) {
    return NextResponse.json({ error: "Reserva de homologação desabilitada." }, { status: 403 });
  }
  try {
    if (previewClaimRequested && !process.env.SUPABASE_SECRET_KEY) {
      return NextResponse.json({ error: "Credencial de homologação indisponível." }, { status: 503 });
    }
    if (previewClaimRequested) {
      // Hard-bind mutable claim tests to the dedicated isolated Supabase project.
      // A Preview deployment accidentally pointed at production must not mutate its queue.
      const dbHost = (() => {
        try {
          return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
        } catch {
          return "";
        }
      })();
      if (dbHost !== "woqpzvqfaeqteiqpsaqi.supabase.co") {
        return NextResponse.json({ error: "Banco de homologação não configurado." }, { status: 403 });
      }
      const admin = createSupabaseAdmin();
      const { data, error } = await admin.rpc("claim_finance_delivery_batch", { p_limit: MAX_BATCH });
      if (error) throw error;
      return NextResponse.json({
        mode: "claim-preview",
        deliveryEnabled: false,
        reserved: data?.length ?? 0,
        message: "Reservas de homologação criadas; nenhum envio realizado."
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const admin = createSupabaseAdmin();
    const now = new Date().toISOString();
    const { data: deliveries, error } = await admin
      .from("myryra_finance_delivery_log")
      .select("id,user_id,notification_id,channel,status,attempts,next_attempt_at")
      .in("status", ["pending", "failed"])
      .lt("attempts", MAX_ATTEMPTS)
      // Filter due work before LIMIT so deferred retries cannot starve ready items.
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH);
    if (error) throw error;

    let eligible = 0;
    let optedOut = 0;
    let missingNotification = 0;
    for (const item of deliveries ?? []) {
      const { data: notification, error: notificationError } = await admin
        .from("myryra_finance_notifications")
        .select("id,user_id")
        .eq("id", item.notification_id)
        .eq("user_id", item.user_id)
        .maybeSingle();
      if (notificationError) throw notificationError;
      if (!notification) {
        missingNotification++;
        continue;
      }
      const { data: prefs, error: prefsError } = await admin
        .from("myryra_finance_alert_preferences")
        .select("email_enabled,push_enabled")
        .eq("user_id", item.user_id)
        .maybeSingle();
      if (prefsError) throw prefsError;
      const consent = item.channel === "email"
        ? prefs?.email_enabled === true
        : item.channel === "push" && prefs?.push_enabled === true;
      if (consent) eligible++;
      else optedOut++;
    }

    return NextResponse.json({
      mode: "dry-run",
      deliveryEnabled: false,
      inspected: deliveries?.length ?? 0,
      eligible,
      optedOut,
      notDue: 0, // Kept for API compatibility; deferred items are excluded in SQL.
      missingNotification,
      maxAttempts: MAX_ATTEMPTS,
      message: "Nenhuma notificação foi enviada ou alterada."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Falha ao inspecionar a fila." }, { status: 503 });
  }
}

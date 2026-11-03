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

  // Deliberately dry-run only: no external provider, no queue mutations or sends.
  try {
    const admin = createSupabaseAdmin();
    const now = new Date().toISOString();
    const { data: deliveries, error } = await admin
      .from("myryra_finance_delivery_log")
      .select("id,user_id,notification_id,channel,status,attempts,next_attempt_at")
      .in("status", ["pending", "failed"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH);
    if (error) throw error;

    let eligible = 0;
    let optedOut = 0;
    let notDue = 0;
    let missingNotification = 0;
    for (const item of deliveries ?? []) {
      if (item.next_attempt_at && item.next_attempt_at > now) {
        notDue++;
        continue;
      }
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
      notDue,
      missingNotification,
      maxAttempts: MAX_ATTEMPTS,
      message: "Nenhuma notificação foi enviada ou alterada."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Falha ao inspecionar a fila." }, { status: 503 });
  }
}

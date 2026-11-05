import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const MAX_ADDRESS_LENGTH = 300;
const TIMEOUT_MS = 6500;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { origin, destination } = body as Record<string, unknown>;
  if (typeof origin !== "string" || typeof destination !== "string" ||
      !origin.trim() || !destination.trim() ||
      origin.length > MAX_ADDRESS_LENGTH || destination.length > MAX_ADDRESS_LENGTH) {
    return NextResponse.json({ error: "Informe origem e destino válidos (até 300 caracteres)." }, { status: 400 });
  }

  // Keep the Google key server-side. No third-party call is made until explicitly configured.
  if (process.env.MYRYRA_CONCIERGE_ROUTES_ENABLED !== "true") {
    return NextResponse.json({ error: "Consulta de rotas ainda não habilitada.", code: "ROUTES_DISABLED" }, { status: 503 });
  }
  const apiKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Consulta de rotas ainda não habilitada.", code: "ROUTES_NOT_CONFIGURED" }, { status: 503 });

  // Reserve quota atomically before any billable Google request. Fail closed if unavailable.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    return NextResponse.json({ error: "Controle de consumo indisponível.", code: "QUOTA_UNAVAILABLE" }, { status: 503 });
  }
  try {
    const admin = createAdminClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: reservation, error: quotaError } = await admin.rpc("reserve_concierge_route_request", {
      p_user_id: user.id,
    });
    if (quotaError || typeof reservation !== "string") {
      return NextResponse.json({ error: "Controle de consumo indisponível.", code: "QUOTA_UNAVAILABLE" }, { status: 503 });
    }
    if (reservation !== "OK") {
      const limited = ["USER_DAILY_LIMIT", "GLOBAL_DAILY_LIMIT", "RATE_LIMIT"].includes(reservation);
      return NextResponse.json({
        error: limited ? "Limite de consultas atingido. Tente novamente mais tarde." : "Consulta indisponível.",
        code: reservation,
      }, { status: limited ? 429 : 503 });
    }
  } catch {
    return NextResponse.json({ error: "Controle de consumo indisponível.", code: "QUOTA_UNAVAILABLE" }, { status: 503 });
  }

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: origin.trim() },
        destination: { address: destination.trim() },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "pt-BR",
        units: "METRIC",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      // Return a safe diagnostic category, never the Google API key or raw provider response.
      const code = response.status === 403 ? "GOOGLE_ACCESS_DENIED"
        : response.status === 401 ? "GOOGLE_KEY_REJECTED"
        : response.status === 429 ? "GOOGLE_QUOTA_EXCEEDED"
        : response.status === 400 ? "GOOGLE_ROUTE_REQUEST_INVALID"
        : "GOOGLE_PROVIDER_ERROR";
      console.error("[concierge/route] Google Routes request failed", { status: response.status, code });
      return NextResponse.json({
        error: response.status === 403 ? "Google Routes recusou o acesso. Verifique faturamento, API habilitada e restrições da chave no Google Cloud."
          : response.status === 401 ? "A chave da API Google Routes foi rejeitada. Verifique as credenciais."
          : response.status === 429 ? "O Google Routes atingiu o limite de consultas. Tente novamente mais tarde."
          : response.status === 400 ? "O Google Routes não aceitou a origem ou o destino. Verifique os endereços."
          : "Não foi possível consultar a rota neste momento.",
        code,
      }, { status: 502 });
    }
    const data = await response.json() as { routes?: Array<{ duration?: string; distanceMeters?: number }> };
    const route = data.routes?.[0];
    const seconds = route?.duration && /^\d+(?:\.\d+)?s$/.test(route.duration)
      ? Math.ceil(Number(route.duration.slice(0, -1))) : null;
    if (seconds === null || !Number.isFinite(seconds)) {
      return NextResponse.json({ error: "Nenhuma rota encontrada." }, { status: 404 });
    }
    return NextResponse.json({
      mode: "driving",
      durationSeconds: seconds,
      distanceMeters: route?.distanceMeters ?? null,
      provider: "google-routes",
      calculatedAt: new Date().toISOString(),
      liveTrafficGuarantee: false,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Consulta de rota indisponível. Tente novamente." }, { status: 504 });
  }
}

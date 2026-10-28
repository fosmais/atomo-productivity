import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type GoogleRouteResponse = {
  routes?: Array<{
    duration?: string;
    distanceMeters?: number;
  }>;
};

const MAX_REQUESTS_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;

// Provisional local-development limit; use persistent storage in production.
const usage = new Map<string, number[]>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGoogleRouteResponse(
  value: unknown
): value is GoogleRouteResponse {
  return (
    isRecord(value) &&
    (value.routes === undefined ||
      (Array.isArray(value.routes) &&
        value.routes.every(
          (route) =>
            isRecord(route) &&
            (route.duration === undefined ||
              typeof route.duration === "string") &&
            (route.distanceMeters === undefined ||
              typeof route.distanceMeters === "number")
        )))
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps não configurado." },
        { status: 503 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "JSON inválido." },
        { status: 400 }
      );
    }

    const origin =
      isRecord(body) && typeof body.origin === "string"
        ? body.origin.trim()
        : "";
    const destination =
      isRecord(body) && typeof body.destination === "string"
        ? body.destination.trim()
        : "";

    if (
      origin.length < 5 ||
      destination.length < 5 ||
      origin.length > 250 ||
      destination.length > 250
    ) {
      return NextResponse.json(
        { error: "Informe origem e destino válidos." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const recent = (usage.get(user.id) ?? []).filter(
      (timestamp) => now - timestamp < WINDOW_MS
    );

    if (recent.length >= MAX_REQUESTS_PER_HOUR) {
      usage.set(user.id, recent);
      return NextResponse.json(
        { error: "Limite de 5 consultas por hora atingido." },
        { status: 429 }
      );
    }

    usage.set(user.id, [...recent, now]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;

    try {
      response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "routes.duration,routes.distanceMeters,routes.staticDuration",
          },
          body: JSON.stringify({
            origin: { address: origin },
            destination: { address: destination },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            languageCode: "pt-BR",
            units: "METRIC",
          }),
          signal: controller.signal,
          cache: "no-store",
        }
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json(
          { error: "A consulta da rota excedeu o tempo limite." },
          { status: 504 }
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorBody = await response.text();

      console.error("Google Routes HTTP:", response.status);
      console.error(
        "Google Routes erro:",
        errorBody.slice(0, 2000)
      );

      return NextResponse.json(
        {
          error: "Não foi possível calcular a rota.",
          googleStatus: response.status,
        },
        { status: 502 }
      );
    }

    let data: GoogleRouteResponse;

    try {
      const responseData: unknown = await response.json();
      if (!isGoogleRouteResponse(responseData)) {
        throw new Error("Resposta Google Routes inválida.");
      }

      data = responseData;
    } catch (error) {
      console.error("Resposta Google Routes inválida:", error);
      return NextResponse.json(
        { error: "Não foi possível interpretar a resposta da rota." },
        { status: 502 }
      );
    }

    const route = data.routes?.[0];

    if (!route) {
      return NextResponse.json(
        { error: "Nenhuma rota encontrada." },
        { status: 404 }
      );
    }

    const durationSeconds = Number.parseFloat(route.duration ?? "0");
    const distanceMeters = route.distanceMeters;

    if (
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0 ||
      typeof distanceMeters !== "number" ||
      !Number.isFinite(distanceMeters) ||
      distanceMeters < 0
    ) {
      return NextResponse.json(
        { error: "Dados de rota inválidos." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        origin,
        destination,
        distanceKm: Number((distanceMeters / 1000).toFixed(1)),
        durationMinutes: Math.ceil(durationSeconds / 60),
        travelMode: "DRIVE",
        trafficAware: true,
        calculatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Erro na API de rotas:", error);

    return NextResponse.json(
      { error: "Erro ao consultar deslocamento." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { authenticateRequest } from "@/lib/supabase/request-client";
import { checkConciergeRateLimit } from "@/lib/rate-limit";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["audio/mp4", "audio/m4a", "audio/mpeg", "audio/mp3", "audio/wav", "audio/webm", "audio/x-m4a"]);

export async function POST(request: Request) {
  try {
    const { supabase, user, mfaRequired, assuranceUnavailable } = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (assuranceUnavailable) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503 });
    if (mfaRequired) return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403 });

    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
      return NextResponse.json({ error: "Envie áudio em formulário multipart." }, { status: 415 });
    }
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_AUDIO_BYTES + 131072) {
      return NextResponse.json({ error: "Áudio maior que 10 MB." }, { status: 413 });
    }
    const form = await request.formData();
    const audio = form.get("file");
    if (!(audio instanceof File) || !ALLOWED_TYPES.has(audio.type) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Áudio inválido. Use M4A, MP3, WAV ou WebM, até 10 MB." }, { status: 400 });
    }
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ error: "Transcrição indisponível." }, { status: 503 });
    let quota: Awaited<ReturnType<typeof checkConciergeRateLimit>>;
    try { quota = await checkConciergeRateLimit(user.id); }
    catch { return NextResponse.json({ error: "Limite temporariamente indisponível." }, { status: 503 }); }
    if (!quota.allowed) return NextResponse.json({ error: "Limite de IA atingido." }, { status: 429 });
    const client = new OpenAI({ apiKey: key, timeout: 30000, maxRetries: 0 });
    const transcription = await client.audio.transcriptions.create({ file: audio, model: "whisper-1", language: "pt" });
    const text = transcription.text.trim().slice(0, 1500);
    if (!text) return NextResponse.json({ error: "Nenhuma fala reconhecida." }, { status: 422 });
    return NextResponse.json({ text }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Falha na transcrição MYKA:", error);
    return NextResponse.json({ error: "Não foi possível transcrever o áudio." }, { status: 500 });
  }
}

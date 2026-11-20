import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Faça login para transcrever o áudio." }, { status: 401 });

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data;"))
      return NextResponse.json({ error: "Envie áudio como formulário multipart." }, { status: 415 });
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > 11 * 1024 * 1024)
      return NextResponse.json({ error: "Envio acima do limite permitido." }, { status: 413 });
    // Content-Length is optional and may be forged: cap the actual multipart bytes.
    if (!request.body) return NextResponse.json({ error: "Áudio não enviado." }, { status: 400 });
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
        if (receivedBytes > 11 * 1024 * 1024) {
          await reader.cancel();
          return NextResponse.json({ error: "Envio acima do limite permitido." }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const payload = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) { payload.set(chunk, offset); offset += chunk.byteLength; }
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: payload,
    });
    const form = await boundedRequest.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) return NextResponse.json({ error: "Arquivo de áudio não enviado." }, { status: 400 });
    if (audio.size < 1 || audio.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: "O áudio deve ter até 10 MB." }, { status: 413 });
    const allowed = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-m4a"];
    const mime = audio.type.split(";")[0].trim().toLowerCase();
    if (!allowed.includes(mime)) return NextResponse.json({ error: "Formato de áudio não suportado neste navegador." }, { status: 415 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Transcrição indisponível no momento." }, { status: 503 });

    const { data: quotaAllowed, error: quotaError } = await supabase.rpc("mika_consume_ai_quota", { p_action: "transcribe" });
    if (quotaError) return NextResponse.json({ error: "Controle de uso indisponível." }, { status: 503 });
    if (!quotaAllowed) return NextResponse.json({ error: "Limite de uso da IA atingido. Tente novamente mais tarde." }, { status: 429, headers: { "Retry-After": "3600" } });
    const openai = new OpenAI({ apiKey, timeout: 30000, maxRetries: 0 });
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-mini-transcribe",
      language: "pt",
      response_format: "json",
    });
    const text = transcription.text?.trim();
    if (!text) return NextResponse.json({ error: "Não foi possível identificar fala no áudio." }, { status: 422 });
    if (text.length > 10000) return NextResponse.json({ error: "Transcrição excedeu o limite de 10.000 caracteres." }, { status: 413 });
    return NextResponse.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("MIKA Insights transcription failed:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Falha ao transcrever o áudio. Você pode digitar sua ideia." }, { status: 502 });
  }
}

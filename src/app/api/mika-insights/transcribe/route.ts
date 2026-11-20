import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Faça login para transcrever o áudio." }, { status: 401 });

    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) return NextResponse.json({ error: "Arquivo de áudio não enviado." }, { status: 400 });
    if (audio.size < 1 || audio.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: "O áudio deve ter até 10 MB." }, { status: 413 });
    const allowed = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-m4a"];
    if (!allowed.includes(audio.type)) return NextResponse.json({ error: "Formato de áudio não suportado neste navegador." }, { status: 415 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Transcrição indisponível no momento." }, { status: 503 });

    const openai = new OpenAI({ apiKey, timeout: 30000, maxRetries: 0 });
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-mini-transcribe",
      language: "pt",
      response_format: "json",
    });
    const text = transcription.text?.trim();
    if (!text) return NextResponse.json({ error: "Não foi possível identificar fala no áudio." }, { status: 422 });
    return NextResponse.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("MIKA Insights transcription failed:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Falha ao transcrever o áudio. Você pode digitar sua ideia." }, { status: 502 });
  }
}

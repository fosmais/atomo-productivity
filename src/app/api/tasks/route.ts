import { NextResponse } from "next/server";
import { validateTaskInput } from "@/lib/task-validation";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0].trim().toLowerCase();

  if (mediaType !== "application/json") {
    return NextResponse.json(
      { error: "Envie um JSON válido." },
      { status: 415 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Envie um JSON válido." },
      { status: 400 }
    );
  }

  const textValue =
    typeof body === "object" && body !== null && "text" in body
      ? body.text
      : undefined;
  const validation = validateTaskInput(textValue);

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { text: validation.text },
    { headers: { "Cache-Control": "no-store" } }
  );
}

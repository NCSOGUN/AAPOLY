import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = process.env.YARN_GPT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { status: "error", message: "YarnGPT voice service is not configured." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null) as
    | { text?: unknown; target_language?: unknown }
    | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const targetLanguage =
    typeof body?.target_language === "string" ? body.target_language : "en";

  if (!text) {
    return NextResponse.json(
      { status: "error", message: "Enter text to speak." },
      { status: 400 },
    );
  }

  const upstream = await fetch(
    "https://api.yarngpt.ai/api/v1/streaming/conversation",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        voice: "idera",
        output_format: "mp3",
        target_language: targetLanguage,
      }),
    },
  );

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => null);
    return NextResponse.json(
      data ?? { status: "error", message: "The voice service could not synthesize audio." },
      { status: upstream.status },
    );
  }

  const audio = await upstream.arrayBuffer();
  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { yarnGptSpeechToEnglish, yarnGptTextToSpeech } from "@/lib/yarngpt-translation";

export const maxDuration = 180;

const translationSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  source_language: z.enum(["yo", "ig", "ha"]),
});

export async function POST(request: Request) {
  const apiKey = process.env.YARN_GPT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { status: "error", message: "YarnGPT voice service is not configured." },
      { status: 503 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = translationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message: "Provide text and a supported Nigerian language." },
      { status: 400 },
    );
  }

  try {
    const audio = await yarnGptTextToSpeech(
      parsed.data.text,
      parsed.data.source_language,
      apiKey,
    );
    const translatedText = await yarnGptSpeechToEnglish(
      audio,
      "typed-language.mp3",
      apiKey,
    );
    return NextResponse.json({ status: "success", data: { translatedText } });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The text could not be translated into English.",
      },
      { status: 502 },
    );
  }
}

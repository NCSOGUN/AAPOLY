import { NextResponse } from "next/server";
import { yarnGptSpeechToEnglish } from "@/lib/yarngpt-translation";

export const maxDuration = 180;

export async function POST(request: Request) {
  const apiKey = process.env.YARN_GPT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { status: "error", message: "YarnGPT voice service is not configured." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const audio = form.get("file");
  if (!(audio instanceof Blob) || !audio.size) {
    return NextResponse.json(
      { status: "error", message: "A voice recording is required." },
      { status: 400 },
    );
  }
  if (audio.size > 64 * 1024 * 1024) {
    return NextResponse.json(
      { status: "error", message: "The recording must be 64 MB or smaller." },
      { status: 413 },
    );
  }

  const contentType = audio.type.toLowerCase();
  const filename = contentType.includes("mp4")
    ? "voice-recording.m4a"
    : contentType.includes("ogg")
      ? "voice-recording.ogg"
      : contentType.includes("wav")
        ? "voice-recording.wav"
        : "voice-recording.webm";

  try {
    const translatedText = await yarnGptSpeechToEnglish(audio, filename, apiKey);
    return NextResponse.json({ status: "success", data: { translatedText } });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The voice recording could not be translated.",
      },
      { status: 502 },
    );
  }
}

const YARNGPT_API = "https://api.yarngpt.ai/api/v1";
const TRANSLATION_TIMEOUT_MS = 150_000;

function providerMessage(data: unknown, fallback: string) {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "object" &&
    data.error !== null &&
    "user_message" in data.error &&
    typeof data.error.user_message === "string"
  ) {
    return data.error.user_message;
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }
  return fallback;
}

async function readProviderJson(response: Response, fallback: string) {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(providerMessage(data, fallback));
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("YarnGPT returned an unreadable response.");
  }
  return data as Record<string, unknown>;
}

export async function yarnGptSpeechToEnglish(
  audio: Blob,
  filename: string,
  apiKey: string,
) {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("target_language", "en");

  const uploadResponse = await fetch(`${YARNGPT_API}/asr`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: form,
    signal: AbortSignal.timeout(TRANSLATION_TIMEOUT_MS),
  });
  const upload = await readProviderJson(
    uploadResponse,
    "The voice recording could not be transcribed.",
  );
  if (typeof upload.job_id !== "string" || !upload.job_id) {
    throw new Error("YarnGPT did not return a transcription job ID.");
  }

  const deadline = Date.now() + TRANSLATION_TIMEOUT_MS;
  let delayMs = 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const statusResponse = await fetch(
      `${YARNGPT_API}/asr/${encodeURIComponent(upload.job_id)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(TRANSLATION_TIMEOUT_MS),
      },
    );
    const status = await readProviderJson(
      statusResponse,
      "The translated transcript could not be retrieved.",
    );

    if (status.status === "failed") {
      throw new Error(
        typeof status.error_message === "string"
          ? status.error_message
          : "YarnGPT could not translate this recording.",
      );
    }

    if (status.status === "completed" && status.translation_status !== "pending") {
      if (status.translation_status === "failed") {
        throw new Error(
          typeof status.translation_user_message === "string"
            ? status.translation_user_message
            : "YarnGPT could not translate this recording into English.",
        );
      }
      const translated =
        typeof status.translated_transcript === "string"
          ? status.translated_transcript.trim()
          : "";
      if (!translated) {
        throw new Error("YarnGPT returned an empty English translation.");
      }
      return translated;
    }
    delayMs = Math.min(delayMs + 1000, 5000);
  }

  throw new Error("Translation took too long. Please try again.");
}

export async function yarnGptTextToSpeech(
  text: string,
  language: string,
  apiKey: string,
) {
  const prepareResponse = await fetch(`${YARNGPT_API}/tts/prepare`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      target_language: language,
      output_format: "mp3",
    }),
    signal: AbortSignal.timeout(TRANSLATION_TIMEOUT_MS),
  });
  const prepared = await readProviderJson(
    prepareResponse,
    "The text could not be converted to audio for translation.",
  );
  if (typeof prepared.stream_url !== "string" || !prepared.stream_url) {
    throw new Error("YarnGPT did not return an audio stream URL.");
  }

  const streamUrl = new URL(prepared.stream_url, YARNGPT_API);
  const streamResponse = await fetch(streamUrl, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(TRANSLATION_TIMEOUT_MS),
  });
  if (!streamResponse.ok) {
    const data: unknown = await streamResponse.json().catch(() => null);
    throw new Error(providerMessage(data, "The speech audio could not be generated."));
  }
  const audio = await streamResponse.blob();
  if (!audio.size) throw new Error("YarnGPT returned an empty audio recording.");
  return audio;
}

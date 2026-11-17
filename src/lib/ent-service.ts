import { NextResponse } from "next/server";

const DEFAULT_ENT_API_BASE_URL = "https://ent-server.hostl.cloud/api/v1";
const REQUEST_TIMEOUT_MS = 15_000;

export async function forwardEntRequest(path: string, init: RequestInit) {
  const apiKey = process.env.ENT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        status: "error",
        code: "SERVICE_NOT_CONFIGURED",
        message:
          process.env.NODE_ENV === "development"
            ? "This app is not connected to the ENT service yet. Your request was not sent. Set ENT_API_KEY in .env.local and restart the development server."
            : "The ENT service is not connected for this app. Your request was not sent. Please contact the app administrator.",
      },
      { status: 503 },
    );
  }

  const baseUrl = process.env.ENT_API_BASE_URL ?? DEFAULT_ENT_API_BASE_URL;

  try {
    const url = new URL(path.replace(/^\//, ""), `${baseUrl.replace(/\/+$/, "")}/`);
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const responseText = await response.text();

    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        {
          status: "error",
          code: "INVALID_SERVICE_RESPONSE",
          message: "The ENT service returned an unreadable response. Please try again.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    return NextResponse.json(
      {
        status: "error",
        code: timedOut ? "SERVICE_TIMEOUT" : "SERVICE_UNAVAILABLE",
        message: timedOut
          ? "The ENT service took too long to respond. Please try again."
          : "The ENT service is temporarily unavailable. Please try again.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}

export function invalidRequest(message: string) {
  return NextResponse.json(
    { status: "error", code: "INVALID_REQUEST", message },
    { status: 400 },
  );
}

export async function readJsonBody(request: Request) {
  try {
    return { data: await request.json(), error: null } as const;
  } catch {
    return { data: null, error: "Request body must be valid JSON." } as const;
  }
}

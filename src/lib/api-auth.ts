import { NextRequest, NextResponse } from "next/server";

/**
 * Optional API key guard for the public /api/v1/* endpoints.
 *
 * To enable: set API_SECRET_KEY in your environment variables.
 * Callers must include the header:  X-API-Key: <your-secret-key>
 *
 * If API_SECRET_KEY is NOT set, all requests are allowed (open mode).
 * This lets you start open and lock it down later without code changes.
 */
export function checkApiKey(req: NextRequest): NextResponse | null {
  const requiredKey = process.env.API_SECRET_KEY;

  // Not configured — open access
  if (!requiredKey) return null;

  const providedKey =
    req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");

  if (!providedKey || providedKey !== requiredKey) {
    return NextResponse.json(
      {
        status: "error",
        message: "Unauthorized. Include your API key in the X-API-Key header.",
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'ApiKey realm="ENT-Care Location Intelligence Service"',
        },
      }
    );
  }

  return null; // key is valid
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

/**
 * API key guard for /api/v1/* endpoints.
 *
 * Keys are managed via the Admin GUI at /admin/api-keys.
 * Each key is stored as a bcrypt hash — only the prefix is shown after creation.
 *
 * Returns null if the key is valid (proceed).
 * Returns a NextResponse with 401 if the key is invalid or missing, or 503 if
 * the key store cannot be reached.
 */
export async function checkApiKey(req: NextRequest): Promise<NextResponse | null> {
  const authorization = req.headers.get("authorization");
  const bearerKey = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const providedKey = req.headers.get("x-api-key") ?? bearerKey;

  if (!providedKey) return unauthorized();

  // Hospital / doctor desktop apps authenticate with a long-lived "hu_" token
  // instead of a managed API key. The token is stored plaintext (it is a bearer
  // token the admin controls), so a direct lookup + active check is enough.
  if (providedKey.startsWith("hu_")) {
    let hospitalUser;
    try {
      hospitalUser = await prisma.hospitalUser.findUnique({
        where: { accessToken: providedKey, active: true },
        select: { id: true },
      });
    } catch (error) {
      console.error("[API key authentication] hospital token lookup failed:", error);
      return keyStoreUnavailable();
    }
    if (!hospitalUser) return unauthorized();
    try {
      await prisma.hospitalUser.update({
        where: { id: hospitalUser.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (error) {
      console.error("[API key authentication] hospital lastLogin update failed:", error);
    }
    return null; // valid
  }

  // The key prefix narrows bcrypt comparisons to keys created with that prefix.
  // Include the older 12-character prefix format during the rollout.
  const prefixes = [...new Set([providedKey.slice(0, 16), providedKey.slice(0, 12)])];
  let candidates;
  try {
    candidates = await prisma.apiKey.findMany({
      where: { active: true, keyPrefix: { in: prefixes } },
      select: { id: true, keyHash: true },
    });
  } catch (error) {
    console.error("[API key authentication] key lookup failed:", error);
    return keyStoreUnavailable();
  }

  let matchedId: string | null = null;
  for (const k of candidates) {
    if (await bcrypt.compare(providedKey, k.keyHash)) {
      matchedId = k.id;
      break;
    }
  }

  if (!matchedId) return unauthorized();

  try {
    await prisma.apiKey.update({
      where: { id: matchedId },
      data: { lastUsedAt: new Date() },
    });
  } catch (error) {
    console.error("[API key authentication] last-used update failed:", error);
  }

  return null; // valid
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    {
      status: "error",
      message:
        "Unauthorized. Include a valid API key in the X-API-Key header. " +
        "Generate one at /admin/api-keys.",
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'ApiKey realm="ENT-Care Location Intelligence Service"',
      },
    }
  );
}

function keyStoreUnavailable(): NextResponse {
  return NextResponse.json(
    {
      status: "error",
      message: "API key authentication is temporarily unavailable.",
      code: "API_KEY_STORE_UNAVAILABLE",
    },
    { status: 503 }
  );
}

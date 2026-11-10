import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// GET — list all API keys (hashes never returned)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        owner: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ status: "success", data: keys });
  } catch (error) {
    console.error("[GET /api/admin/api-keys]", error);
    return NextResponse.json(
      { status: "error", message: "Could not load API keys." },
      { status: 500 }
    );
  }
}

// POST — generate a new API key
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  let body: { name?: unknown; owner?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }
  const { name, owner } = body;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { status: "error", message: "name is required." },
      { status: 400 }
    );
  }
  if (name.trim().length > 100) {
    return NextResponse.json(
      { status: "error", message: "name must be 100 characters or fewer." },
      { status: 400 }
    );
  }
  if (owner !== undefined && owner !== null && typeof owner !== "string") {
    return NextResponse.json(
      { status: "error", message: "owner must be a string." },
      { status: 400 }
    );
  }

  try {
    // Generate: "ent_" + 48 random hex chars
    const rawKey = "ent_" + crypto.randomBytes(24).toString("hex");
    const keyPrefix = rawKey.slice(0, 16);
    const keyHash = await bcrypt.hash(rawKey, 10);

    const apiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        owner: typeof owner === "string" ? owner.trim() || null : null,
        keyHash,
        keyPrefix,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        owner: true,
        active: true,
        createdAt: true,
      },
    });

    // Return the raw key ONCE — it won't be retrievable again
    return NextResponse.json(
      { status: "success", data: { ...apiKey, rawKey } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/api-keys]", error);
    return NextResponse.json(
      { status: "error", message: "Could not create API key." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const authError = await checkApiKey(req);
  if (authError) return authError;

  const { id } = await params;

  let body: { consent?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Request body must be valid JSON." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { consent, email } = body;

  if (typeof consent !== "boolean") {
    return NextResponse.json(
      { status: "error", message: "consent must be a boolean." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const existing = await prisma.escalatedCase.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { status: "error", message: "Escalated case not found." },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  let updated;
  try {
    if (consent === true) {
      updated = await prisma.escalatedCase.update({
        where: { id },
        data: {
          consentGiven: true,
          patientEmail: typeof email === "string" ? email : null,
        },
      });
    } else {
      updated = await prisma.escalatedCase.update({
        where: { id },
        data: { status: "closed" },
      });
    }
  } catch (error) {
    console.error("[POST /api/v1/escalation/:id/consent]", error);
    return NextResponse.json(
      { status: "error", message: "Could not update case consent." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(
    {
      status: "success",
      data: {
        id: updated.id,
        consentGiven: updated.consentGiven,
        status: updated.status,
      },
    },
    { headers: CORS_HEADERS }
  );
}

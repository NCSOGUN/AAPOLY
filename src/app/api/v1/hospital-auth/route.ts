import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST — desktop app first-time (online) login. No API key guard: this IS the
// credential check that hands out the long-lived bearer token.
export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { email, password } = body;
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return NextResponse.json(
      { status: "error", message: "email and password are required." },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.hospitalUser.findUnique({
      where: { email: email.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        specialization: true,
        facilityId: true,
        accessToken: true,
        tokenIssuedAt: true,
        active: true,
        facility: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
            accredited: true,
            specialties: { include: { specialty: { select: { name: true } } } },
          },
        },
      },
    });

    // Verify credentials before revealing account state, so a wrong password
    // never discloses whether the account is disabled.
    const valid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, "$2a$10$abcdefghijklmnopqrstuv").then(() => false);

    if (!user || !valid) {
      return NextResponse.json(
        {
          status: "error",
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        {
          status: "error",
          code: "ACCOUNT_DISABLED",
          message: "This account has been disabled. Contact your administrator.",
        },
        { status: 403 }
      );
    }

    // Stamp the login time; a failed update must not block the login.
    try {
      await prisma.hospitalUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (error) {
      console.error("[POST /api/v1/hospital-auth] lastLoginAt update failed:", error);
    }

    const facility = user.facility
      ? {
          id: user.facility.id,
          name: user.facility.name,
          city: user.facility.city,
          state: user.facility.state,
          latitude: user.facility.latitude,
          longitude: user.facility.longitude,
          accredited: user.facility.accredited,
          specialties: user.facility.specialties.map((s) => s.specialty.name),
        }
      : null;

    return NextResponse.json({
      status: "success",
      data: {
        token: user.accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          specialization: user.specialization,
          facilityId: user.facilityId,
          facility,
        },
        tokenIssuedAt: user.tokenIssuedAt.toISOString(),
        instructions:
          "Store this token securely. Use it as X-API-Key header or Authorization: Bearer on all subsequent API calls.",
      },
    });
  } catch (error) {
    console.error("[POST /api/v1/hospital-auth]", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

// CORS preflight for the desktop app
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    },
  });
}

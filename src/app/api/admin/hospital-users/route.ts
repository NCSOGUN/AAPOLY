import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const VALID_ROLES = ["doctor", "specialist", "nurse", "admin"];

// GET — list all hospital users (passwordHash + accessToken never returned)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  try {
    const users = await prisma.hospitalUser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        specialization: true,
        phone: true,
        licenseNumber: true,
        facilityId: true,
        accessToken: true,
        tokenIssuedAt: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        facility: { select: { id: true, name: true } },
      },
    });

    // Omit accessToken; surface only a non-secret prefix for display.
    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      specialization: u.specialization,
      phone: u.phone,
      licenseNumber: u.licenseNumber,
      facilityId: u.facilityId,
      facility: u.facility,
      tokenPrefix: u.accessToken.slice(0, 8) + "…",
      tokenIssuedAt: u.tokenIssuedAt,
      active: u.active,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));

    return NextResponse.json({ status: "success", data });
  } catch (error) {
    console.error("[GET /api/admin/hospital-users]", error);
    return NextResponse.json(
      { status: "error", message: "Could not load hospital users." },
      { status: 500 }
    );
  }
}

// POST — create a new hospital user (returns the access token ONCE)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  let body: {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
    specialization?: unknown;
    phone?: unknown;
    licenseNumber?: unknown;
    facilityId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { name, email, password, role, specialization, phone, licenseNumber, facilityId } = body;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ status: "error", message: "name is required." }, { status: 400 });
  }
  if (name.trim().length > 100) {
    return NextResponse.json(
      { status: "error", message: "name must be 100 characters or fewer." },
      { status: 400 }
    );
  }
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ status: "error", message: "email is required." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { status: "error", message: "password must be at least 6 characters." },
      { status: 400 }
    );
  }
  const resolvedRole = typeof role === "string" ? role : "doctor";
  if (!VALID_ROLES.includes(resolvedRole)) {
    return NextResponse.json(
      { status: "error", message: `role must be one of: ${VALID_ROLES.join(", ")}.` },
      { status: 400 }
    );
  }
  if (
    specialization !== undefined &&
    specialization !== null &&
    typeof specialization !== "string"
  ) {
    return NextResponse.json({ status: "error", message: "specialization must be a string." }, { status: 400 });
  }
  if (phone !== undefined && phone !== null && typeof phone !== "string") {
    return NextResponse.json({ status: "error", message: "phone must be a string." }, { status: 400 });
  }
  if (
    licenseNumber !== undefined &&
    licenseNumber !== null &&
    typeof licenseNumber !== "string"
  ) {
    return NextResponse.json({ status: "error", message: "licenseNumber must be a string." }, { status: 400 });
  }

  // Optional facility link — verify it exists when provided.
  const resolvedFacilityId =
    typeof facilityId === "string" && facilityId.trim() ? facilityId.trim() : null;
  if (resolvedFacilityId) {
    try {
      const facility = await prisma.facility.findUnique({
        where: { id: resolvedFacilityId },
        select: { id: true },
      });
      if (!facility) {
        return NextResponse.json(
          { status: "error", message: "facilityId does not match an existing facility." },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("[POST /api/admin/hospital-users] facility lookup failed:", error);
      return NextResponse.json(
        { status: "error", message: "Could not verify facility." },
        { status: 500 }
      );
    }
  }

  try {
    // Long-lived bearer token the admin controls (not a password).
    const token = "hu_" + crypto.randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.hospitalUser.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        passwordHash,
        role: resolvedRole,
        specialization:
          typeof specialization === "string" ? specialization.trim() || null : null,
        phone: typeof phone === "string" ? phone.trim() || null : null,
        licenseNumber:
          typeof licenseNumber === "string" ? licenseNumber.trim() || null : null,
        facilityId: resolvedFacilityId,
        accessToken: token,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        specialization: true,
        phone: true,
        licenseNumber: true,
        facilityId: true,
        active: true,
        tokenIssuedAt: true,
        createdAt: true,
      },
    });

    // Return the full token ONCE — it is not retrievable again.
    return NextResponse.json(
      {
        status: "success",
        data: {
          ...created,
          tokenPrefix: token.slice(0, 8) + "…",
          token,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // P2002 — unique constraint violation (email already registered)
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { status: "error", message: "A user with this email already exists." },
        { status: 409 }
      );
    }
    console.error("[POST /api/admin/hospital-users]", error);
    return NextResponse.json(
      { status: "error", message: "Could not create hospital user." },
      { status: 500 }
    );
  }
}

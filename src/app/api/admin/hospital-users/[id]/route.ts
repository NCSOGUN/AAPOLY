import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const VALID_ROLES = ["doctor", "specialist", "nurse", "admin"];

// Shape returned by GET/PATCH — passwordHash + accessToken never exposed.
function publicShape(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization: string | null;
  phone: string | null;
  licenseNumber: string | null;
  facilityId: string | null;
  accessToken: string;
  tokenIssuedAt: Date;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  facility: { id: string; name: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    specialization: user.specialization,
    phone: user.phone,
    licenseNumber: user.licenseNumber,
    facilityId: user.facilityId,
    facility: user.facility,
    tokenPrefix: user.accessToken.slice(0, 8) + "…",
    tokenIssuedAt: user.tokenIssuedAt,
    active: user.active,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

// GET — a single hospital user
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const user = await prisma.hospitalUser.findUnique({
      where: { id },
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

    if (!user) {
      return NextResponse.json({ status: "error", message: "Hospital user not found." }, { status: 404 });
    }
    return NextResponse.json({ status: "success", data: publicShape(user) });
  } catch (error) {
    console.error("[GET /api/admin/hospital-users/:id]", error);
    return NextResponse.json(
      { status: "error", message: "Could not load hospital user." },
      { status: 500 }
    );
  }
}

// PATCH — update profile fields / status (no password, email, or token here)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: {
    name?: unknown;
    role?: unknown;
    specialization?: unknown;
    phone?: unknown;
    licenseNumber?: unknown;
    facilityId?: unknown;
    active?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ status: "error", message: "name must be a non-empty string." }, { status: 400 });
    }
    if (body.name.trim().length > 100) {
      return NextResponse.json(
        { status: "error", message: "name must be 100 characters or fewer." },
        { status: 400 }
      );
    }
    data.name = body.name.trim();
  }
  if (body.role !== undefined) {
    if (typeof body.role !== "string" || !VALID_ROLES.includes(body.role)) {
      return NextResponse.json(
        { status: "error", message: `role must be one of: ${VALID_ROLES.join(", ")}.` },
        { status: 400 }
      );
    }
    data.role = body.role;
  }
  if (body.specialization !== undefined) {
    if (body.specialization !== null && typeof body.specialization !== "string") {
      return NextResponse.json({ status: "error", message: "specialization must be a string or null." }, { status: 400 });
    }
    data.specialization = typeof body.specialization === "string" ? body.specialization.trim() || null : null;
  }
  if (body.phone !== undefined) {
    if (body.phone !== null && typeof body.phone !== "string") {
      return NextResponse.json({ status: "error", message: "phone must be a string or null." }, { status: 400 });
    }
    data.phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  }
  if (body.licenseNumber !== undefined) {
    if (body.licenseNumber !== null && typeof body.licenseNumber !== "string") {
      return NextResponse.json({ status: "error", message: "licenseNumber must be a string or null." }, { status: 400 });
    }
    data.licenseNumber = typeof body.licenseNumber === "string" ? body.licenseNumber.trim() || null : null;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ status: "error", message: "active must be boolean." }, { status: 400 });
    }
    data.active = body.active;
  }
  if (body.facilityId !== undefined) {
    // Allow null/empty to unlink the user from a facility.
    const nextFacilityId =
      typeof body.facilityId === "string" && body.facilityId.trim() ? body.facilityId.trim() : null;
    if (nextFacilityId) {
      try {
        const facility = await prisma.facility.findUnique({
          where: { id: nextFacilityId },
          select: { id: true },
        });
        if (!facility) {
          return NextResponse.json(
            { status: "error", message: "facilityId does not match an existing facility." },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error("[PATCH /api/admin/hospital-users/:id] facility lookup failed:", error);
        return NextResponse.json(
          { status: "error", message: "Could not verify facility." },
          { status: 500 }
        );
      }
    }
    data.facilityId = nextFacilityId;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { status: "error", message: "No updatable fields provided." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.hospitalUser.update({
      where: { id },
      data,
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

    return NextResponse.json({ status: "success", data: publicShape(updated) });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ status: "error", message: "Hospital user not found." }, { status: 404 });
    }
    console.error("[PATCH /api/admin/hospital-users/:id]", error);
    return NextResponse.json(
      { status: "error", message: "Could not update hospital user." },
      { status: 500 }
    );
  }
}

// DELETE — hard delete a hospital user
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.hospitalUser.delete({ where: { id } });
    return NextResponse.json({ status: "success", data: { id } });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ status: "error", message: "Hospital user not found." }, { status: 404 });
    }
    console.error("[DELETE /api/admin/hospital-users/:id]", error);
    return NextResponse.json(
      { status: "error", message: "Could not delete hospital user." },
      { status: 500 }
    );
  }
}

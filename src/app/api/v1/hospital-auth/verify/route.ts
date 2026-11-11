import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — re-verify a hospital token after the desktop app wakes from offline.
// Accepts X-Hospital-Token OR Authorization: Bearer; validates by direct string
// match on accessToken + active:true. Does not echo the token back.
export async function GET(req: NextRequest) {
  const headerToken = req.headers.get("x-hospital-token");
  const authorization = req.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = headerToken ?? bearerToken;

  if (!token) {
    return NextResponse.json(
      {
        status: "error",
        code: "INVALID_CREDENTIALS",
        message: "Token is missing or invalid.",
      },
      { status: 401 }
    );
  }

  try {
    const user = await prisma.hospitalUser.findUnique({
      where: { accessToken: token, active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        specialization: true,
        facilityId: true,
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

    if (!user) {
      return NextResponse.json(
        {
          status: "error",
          code: "INVALID_CREDENTIALS",
          message: "Token is missing or invalid.",
        },
        { status: 401 }
      );
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
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          specialization: user.specialization,
          facilityId: user.facilityId,
          facility,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/v1/hospital-auth/verify]", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

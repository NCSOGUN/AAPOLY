import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkApiKey } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkApiKey(_req);
  if (authError) return authError;

  try {
    const { id } = await params;

    const facility = await prisma.facility.findUnique({
      where: { id },
      include: {
        specialties: { include: { specialty: true } },
        services: true,
      },
    });

    if (!facility) {
      return NextResponse.json(
        { status: "error", message: "Facility not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      data: {
        ...facility,
        specialties: facility.specialties.map((s) => ({
          id: s.specialty.id,
          name: s.specialty.name,
          code: s.specialty.code,
          description: s.specialty.description,
        })),
        services: facility.services,
      },
    });
  } catch (err) {
    console.error("[/api/v1/facilities/:id]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    },
  });
}

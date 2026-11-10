import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
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

    return NextResponse.json({ status: "success", data: facility });
  } catch (err) {
    console.error("[GET /api/admin/facilities/:id]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const {
      name,
      slug,
      address,
      city,
      state,
      country,
      latitude,
      longitude,
      phone,
      email,
      website,
      accredited,
      accreditationDate,
      notes,
      specialtyIds,
      services,
    } = body;

    // Replace specialties and services wholesale
    const facility = await prisma.facility.update({
      where: { id },
      data: {
        name,
        slug,
        address,
        city,
        state,
        country,
        latitude: latitude !== undefined ? parseFloat(latitude) : undefined,
        longitude: longitude !== undefined ? parseFloat(longitude) : undefined,
        phone,
        email,
        website,
        accredited,
        accreditationDate: accreditationDate ? new Date(accreditationDate) : null,
        notes,
        specialties: {
          deleteMany: {},
          create: (specialtyIds ?? []).map((sid: string) => ({
            specialtyId: sid,
          })),
        },
        services: {
          deleteMany: {},
          create: (services ?? []).map((svc: { name: string; available: boolean } | string) => ({
            name: typeof svc === "string" ? svc : svc.name,
            available: typeof svc === "string" ? true : (svc.available ?? true),
          })),
        },
      },
      include: {
        specialties: { include: { specialty: true } },
        services: true,
      },
    });

    return NextResponse.json({ status: "success", data: facility });
  } catch (err: unknown) {
    console.error("[PUT /api/admin/facilities/:id]", err);
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { status: "error", message: "A facility with that slug already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.facility.delete({ where: { id } });
    return NextResponse.json({ status: "success", data: { id } });
  } catch (err) {
    console.error("[DELETE /api/admin/facilities/:id]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

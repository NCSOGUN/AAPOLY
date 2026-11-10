import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
            { state: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [facilities, total] = await Promise.all([
      prisma.facility.findMany({
        where,
        include: {
          specialties: { include: { specialty: true } },
          services: true,
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.facility.count({ where }),
    ]);

    return NextResponse.json({
      status: "success",
      data: {
        facilities,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/facilities]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

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
      operatingHours,
      notes,
      specialtyIds,
      services,
    } = body;

    if (!name || !slug || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { status: "error", message: "name, slug, latitude, longitude are required." },
        { status: 400 }
      );
    }

    const facility = await prisma.facility.create({
      data: {
        name,
        slug,
        address,
        city,
        state: state ?? "Ogun",
        country: country ?? "Nigeria",
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        phone,
        email,
        website,
        accredited: accredited ?? false,
        accreditationDate: accreditationDate ? new Date(accreditationDate) : null,
        operatingHours: operatingHours ?? null,
        notes,
        specialties: specialtyIds?.length
          ? {
              create: (specialtyIds as string[]).map((id: string) => ({
                specialtyId: id,
              })),
            }
          : undefined,
        services: services?.length
          ? {
              create: (services as Array<{ name: string; available: boolean } | string>).map((svc) => ({
                name: typeof svc === "string" ? svc : svc.name,
                available: typeof svc === "string" ? true : (svc.available ?? true),
              })),
            }
          : undefined,
      },
      include: {
        specialties: { include: { specialty: true } },
        services: true,
      },
    });

    return NextResponse.json({ status: "success", data: facility }, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/admin/facilities]", err);
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

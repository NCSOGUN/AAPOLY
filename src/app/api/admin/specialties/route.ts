import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  try {
    const specialties = await prisma.specialty.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { facilities: true } } },
    });

    return NextResponse.json({ status: "success", data: specialties });
  } catch (err) {
    console.error("[GET /api/admin/specialties]", err);
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
    const { name, code, description } = body;

    if (!name) {
      return NextResponse.json(
        { status: "error", message: "name is required." },
        { status: 400 }
      );
    }

    const specialty = await prisma.specialty.create({
      data: { name, code: code || null, description: description || null },
    });

    return NextResponse.json({ status: "success", data: specialty }, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/admin/specialties]", err);
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { status: "error", message: "A specialty with that name or code already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

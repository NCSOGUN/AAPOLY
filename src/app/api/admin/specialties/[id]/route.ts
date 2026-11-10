import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, code, description } = body;

    const specialty = await prisma.specialty.update({
      where: { id },
      data: {
        name,
        code: code ?? null,
        description: description ?? null,
      },
    });

    return NextResponse.json({ status: "success", data: specialty });
  } catch (err: unknown) {
    console.error("[PUT /api/admin/specialties/:id]", err);
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { status: "error", message: "Name or code conflict." },
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
    await prisma.specialty.delete({ where: { id } });
    return NextResponse.json({ status: "success", data: { id } });
  } catch (err) {
    console.error("[DELETE /api/admin/specialties/:id]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

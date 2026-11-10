import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/facilities/:id/accreditation — toggle accreditation status
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { accredited } = body;

    if (typeof accredited !== "boolean") {
      return NextResponse.json(
        { status: "error", message: "accredited must be a boolean." },
        { status: 400 }
      );
    }

    const facility = await prisma.facility.update({
      where: { id },
      data: {
        accredited,
        accreditationDate: accredited ? new Date() : null,
      },
      select: { id: true, name: true, accredited: true, accreditationDate: true },
    });

    return NextResponse.json({ status: "success", data: facility });
  } catch (err) {
    console.error("[PATCH /api/admin/facilities/:id/accreditation]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

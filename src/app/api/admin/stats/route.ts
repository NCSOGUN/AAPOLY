import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [totalFacilities, accreditedCount, totalSpecialties, totalServices] =
      await Promise.all([
        prisma.facility.count(),
        prisma.facility.count({ where: { accredited: true } }),
        prisma.specialty.count(),
        prisma.facilityService.count({ where: { available: true } }),
      ]);

    return NextResponse.json({
      status: "success",
      data: { totalFacilities, accreditedCount, totalSpecialties, totalServices },
    });
  } catch (err) {
    console.error("[/api/admin/stats]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

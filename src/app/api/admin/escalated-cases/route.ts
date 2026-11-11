import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 }
    );

  const status = req.nextUrl.searchParams.get("status");

  try {
    const cases = await prisma.escalatedCase.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ status: "success", data: cases });
  } catch (error) {
    console.error("[GET /api/admin/escalated-cases]", error);
    return NextResponse.json(
      { status: "error", message: "Could not load escalated cases." },
      { status: 500 }
    );
  }
}

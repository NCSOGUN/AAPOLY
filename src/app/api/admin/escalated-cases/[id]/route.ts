import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session)
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 }
    );

  const { id } = await params;

  let body: { specialistNotes?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { specialistNotes, status } = body;

  try {
    const updated = await prisma.escalatedCase.update({
      where: { id },
      data: {
        ...(specialistNotes !== undefined && {
          specialistNotes: typeof specialistNotes === "string" ? specialistNotes : null,
        }),
        ...(status !== undefined && {
          status: typeof status === "string" ? status : undefined,
        }),
      },
    });

    return NextResponse.json({ status: "success", data: updated });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "P2025") {
      return NextResponse.json(
        { status: "error", message: "Escalated case not found." },
        { status: 404 }
      );
    }
    console.error("[PATCH /api/admin/escalated-cases/:id]", error);
    return NextResponse.json(
      { status: "error", message: "Could not update escalated case." },
      { status: 500 }
    );
  }
}

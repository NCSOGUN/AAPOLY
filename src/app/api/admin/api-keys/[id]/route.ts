import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// PATCH — toggle active status (revoke / re-enable)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { active?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }
  const { active } = body;

  if (typeof active !== "boolean") {
    return NextResponse.json({ status: "error", message: "active must be boolean." }, { status: 400 });
  }

  try {
    const key = await prisma.apiKey.update({
      where: { id },
      data: { active },
      select: { id: true, name: true, keyPrefix: true, active: true },
    });

    return NextResponse.json({ status: "success", data: key });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ status: "error", message: "API key not found." }, { status: 404 });
    }
    console.error("[PATCH /api/admin/api-keys/:id]", error);
    return NextResponse.json({ status: "error", message: "Could not update API key." }, { status: 500 });
  }
}

// DELETE — permanently delete a key
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.apiKey.delete({ where: { id } });
    return NextResponse.json({ status: "success", data: { id } });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ status: "error", message: "API key not found." }, { status: 404 });
    }
    console.error("[DELETE /api/admin/api-keys/:id]", error);
    return NextResponse.json({ status: "error", message: "Could not delete API key." }, { status: 500 });
  }
}

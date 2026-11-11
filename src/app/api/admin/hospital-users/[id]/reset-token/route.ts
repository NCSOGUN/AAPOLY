import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type Ctx = { params: Promise<{ id: string }> };

// POST — issue a replacement access token (e.g. after a token compromise).
// The new token is returned ONCE.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const newToken = "hu_" + crypto.randomBytes(32).toString("hex");
    await prisma.hospitalUser.update({
      where: { id },
      data: { accessToken: newToken, tokenIssuedAt: new Date() },
    });

    return NextResponse.json({ status: "success", data: { id, token: newToken } });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ status: "error", message: "Hospital user not found." }, { status: 404 });
    }
    console.error("[POST /api/admin/hospital-users/:id/reset-token]", error);
    return NextResponse.json(
      { status: "error", message: "Could not reset token." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ trackingId: string }> };

/**
 * GET /api/v1/reports/:trackingId
 *
 * Fetch a saved diagnosis report by its tracking ID.
 * No authentication required beyond a valid API key — the trackingId
 * itself is the access token for the report (share it, own it).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const authError = await checkApiKey(_req);
  if (authError) return authError;

  try {
    const { trackingId } = await params;

    const report = await prisma.diagnosisReport.findUnique({
      where: { trackingId: trackingId.toUpperCase() },
      include: {
        patientProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            // Never return passportPhotoKey or other sensitive fields here
            passportPhotoUrl: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        {
          status: "error",
          code: "REPORT_NOT_FOUND",
          message: `No report found with tracking ID "${trackingId.toUpperCase()}". Check the ID and try again.`,
        },
        { status: 404 }
      );
    }

    // Update status to "viewed" if first retrieval
    if (report.status === "generated") {
      await prisma.diagnosisReport.update({
        where: { id: report.id },
        data: { status: "viewed" },
      }).catch(() => {}); // non-fatal
    }

    return NextResponse.json({
      status: "success",
      data: {
        trackingId: report.trackingId,
        createdAt: report.createdAt,
        status: report.status,

        // Input summary
        input: {
          symptoms: report.symptoms,
          affectedArea: report.affectedArea,
          duration: report.duration,
          age: report.age,
          additionalContext: report.additionalContext,
        },

        // Clinical result
        clinical: {
          primaryConditionId: report.primaryConditionId,
          primaryConditionName: report.primaryConditionName,
          urgencyScore: report.urgencyScore,
          urgencyLevel: report.urgencyLevel,
          referralThreshold: report.referralThreshold,
        },

        // Full analysis (the original response from /analyze)
        analysisResult: report.analysisResult,

        // Location
        location: {
          latitude: report.latitude,
          longitude: report.longitude,
          place: report.place,
        },

        // Nearby facilities at time of report
        nearbyFacilities: report.nearbyFacilities,

        // PDF (if generated)
        pdfUrl: report.pdfUrl ?? null,

        // Patient profile (if linked)
        patient: report.patientProfile ?? null,

        // Images
        hasImages: report.inputImageKeys.length > 0,
        imageCount: report.inputImageKeys.length,
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/reports/:trackingId]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-Hospital-Token",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateTrackingId } from "@/lib/tracking-id";

/**
 * POST /api/v1/reports
 *
 * Save a diagnosis report after the analysis is complete.
 * Always creates a trackingId.
 * Optionally links to a PatientProfile if patientProfileId is provided.
 *
 * The Patient App calls this after /api/v1/analyze to persist the result.
 */
export async function POST(req: NextRequest) {
  const authError = await checkApiKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();

    const {
      // Input
      symptoms,
      affectedArea,
      duration,
      age,
      additionalContext,
      inputImageKeys,

      // Analysis (the full response from /api/v1/analyze)
      analysisResult,

      // Clinical summary (pulled from analysisResult for indexing)
      primaryConditionId,
      primaryConditionName,
      urgencyScore,
      urgencyLevel,
      referralThreshold,

      // Location
      latitude,
      longitude,
      place,

      // Nearby facilities snapshot
      nearbyFacilities,

      // Optional patient link
      patientProfileId,
    } = body;

    if (!symptoms || !analysisResult) {
      return NextResponse.json(
        { status: "error", message: "symptoms and analysisResult are required." },
        { status: 400 }
      );
    }

    // Generate unique tracking ID (retry once on collision — extremely unlikely)
    let trackingId = generateTrackingId();
    const existing = await prisma.diagnosisReport.findUnique({ where: { trackingId } });
    if (existing) trackingId = generateTrackingId();

    const report = await prisma.diagnosisReport.create({
      data: {
        trackingId,
        symptoms,
        affectedArea: affectedArea ?? null,
        duration: duration ?? null,
        age: age ?? null,
        additionalContext: additionalContext ?? null,
        inputImageKeys: inputImageKeys ?? [],
        analysisResult,
        primaryConditionId: primaryConditionId ?? null,
        primaryConditionName: primaryConditionName ?? null,
        urgencyScore: urgencyScore ?? null,
        urgencyLevel: urgencyLevel ?? null,
        referralThreshold: referralThreshold ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        place: place ?? null,
        nearbyFacilities: nearbyFacilities ?? null,
        patientProfileId: patientProfileId ?? null,
      },
    });

    return NextResponse.json(
      {
        status: "success",
        data: {
          id: report.id,
          trackingId: report.trackingId,
          createdAt: report.createdAt,
          message:
            "Report saved. Use the trackingId to retrieve this report at any time.",
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/v1/reports]", err);
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-Hospital-Token",
    },
  });
}

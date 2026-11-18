import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateTrackingId } from "@/lib/tracking-id";
import {
  normalizePhone,
  isValidNigerianPhone,
  composeSmsMessage,
} from "@/lib/phone-tracking";

/**
 * POST /api/v1/reports
 *
 * Save a diagnosis report. Supports two tracking modes:
 *
 * Mode 1 — Phone tracking (recommended, OPay-inspired):
 *   Send `phone: "09154996570"` → normalized to +2349154996570
 *   The phone number becomes the report's tracking ID.
 *   The patient retrieves all their reports with just their number.
 *   A simulated SMS is returned (real SMS when gateway is configured).
 *
 * Mode 2 — Code tracking (fallback):
 *   No phone provided → system generates ENT-2026-XXXXXXXX code.
 *   Patient must save and remember this code.
 */
export async function POST(req: NextRequest) {
  const authError = await checkApiKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();

    const {
      symptoms,
      affectedArea,
      duration,
      age,
      additionalContext,
      inputImageKeys,
      analysisResult,
      primaryConditionId,
      primaryConditionName,
      urgencyScore,
      urgencyLevel,
      referralThreshold,
      latitude,
      longitude,
      place,
      nearbyFacilities,
      patientProfileId,
      phone, // ← NEW: patient's phone number for phone-based tracking
    } = body;

    if (!symptoms || !analysisResult) {
      return NextResponse.json(
        { status: "error", message: "symptoms and analysisResult are required." },
        { status: 400 }
      );
    }

    // ── Determine tracking mode ───────────────────────────────────────────────
    let trackingId: string;
    let phoneTrackingId: string | null = null;
    let smsPayload = null;
    let trackingMode: "phone" | "code" = "code";

    if (phone) {
      // Validate the Nigerian phone number
      if (!isValidNigerianPhone(phone)) {
        return NextResponse.json(
          {
            status: "error",
            code: "INVALID_PHONE",
            message:
              `"${phone}" is not a valid Nigerian mobile number. ` +
              `Use format: 09154996570 or +2349154996570.`,
          },
          { status: 400 }
        );
      }

      const normalized = normalizePhone(phone);
      if (!normalized) {
        return NextResponse.json(
          { status: "error", message: "Could not normalize phone number." },
          { status: 400 }
        );
      }

      phoneTrackingId = normalized;
      trackingId = normalized; // phone IS the tracking ID
      trackingMode = "phone";

      // Compose the simulated SMS
      smsPayload = composeSmsMessage({
        phone: normalized,
        primaryCondition: primaryConditionName ?? "ENT condition",
        urgencyLevel: urgencyLevel ?? "Routine",
        createdAt: new Date(),
      });
    } else {
      // Fall back to generated code
      trackingId = generateTrackingId();
      const collision = await prisma.diagnosisReport.findUnique({
        where: { trackingId },
      });
      if (collision) trackingId = generateTrackingId();
    }

    // ── Check for existing report with same phone (upsert latest) ────────────
    // If a patient submits multiple times with the same phone, we keep ALL
    // reports but each has its own row. Phone lookup returns all of them.
    // The trackingId (phone) is NOT unique per report — only phoneTrackingId
    // stores the phone. The unique trackingId for phone-mode uses
    // phone + timestamp to stay unique.
    if (trackingMode === "phone") {
      // Make trackingId unique: phone + timestamp suffix
      const ts = Date.now().toString(36).toUpperCase();
      trackingId = `${phoneTrackingId}-${ts}`;
    }

    const report = await prisma.diagnosisReport.create({
      data: {
        trackingId,
        phoneTrackingId,
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
        smsSimulated: trackingMode === "phone",
      },
    });

    return NextResponse.json(
      {
        status: "success",
        data: {
          id: report.id,
          trackingId: report.trackingId,
          trackingMode,
          phoneTrackingId: report.phoneTrackingId,
          createdAt: report.createdAt,

          // Phone mode — tell user their number is the key
          ...(trackingMode === "phone"
            ? {
                message:
                  `Report saved. Use your phone number ${phoneTrackingId} ` +
                  `to retrieve all your reports at any time — no need to remember a code.`,
                sms: smsPayload, // Simulated SMS for demo/testing
              }
            : {
                message:
                  "Report saved. Use the trackingId to retrieve this report at any time.",
                sms: null,
              }),
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
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-API-Key, X-Hospital-Token",
    },
  });
}

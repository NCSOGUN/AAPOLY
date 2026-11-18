import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone, isValidNigerianPhone } from "@/lib/phone-tracking";

type Ctx = { params: Promise<{ trackingId: string }> };

/**
 * GET /api/v1/reports/:trackingId
 *
 * Fetch saved diagnosis report(s).
 * Supports THREE lookup methods:
 *
 * 1. Phone number (recommended):
 *    GET /api/v1/reports/09154996570
 *    GET /api/v1/reports/+2349154996570
 *    Returns ALL reports linked to that phone number, newest first.
 *
 * 2. Generated code:
 *    GET /api/v1/reports/ENT-2026-A3F9C2D1
 *    Returns the single report with that exact code.
 *
 * 3. Full phone-keyed ID:
 *    GET /api/v1/reports/+2349154996570-M5X2KJ
 *    Returns the specific report with that unique ID.
 *
 * The phone number is the tracking ID — just like OPay uses your number
 * as your account identifier.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const authError = await checkApiKey(req);
  if (authError) return authError;

  try {
    const { trackingId: rawParam } = await params;
    const decoded = decodeURIComponent(rawParam);

    // ── Determine lookup type ─────────────────────────────────────────────────

    // Check if the param looks like a phone number
    const isPhone = isValidNigerianPhone(decoded.replace(/\s/g, ""));

    if (isPhone) {
      // Phone lookup — return ALL reports for this number, newest first
      const normalized = normalizePhone(decoded.replace(/\s/g, ""));
      if (!normalized) {
        return NextResponse.json(
          { status: "error", message: "Could not normalize phone number." },
          { status: 400 }
        );
      }

      const reports = await prisma.diagnosisReport.findMany({
        where: { phoneTrackingId: normalized },
        orderBy: { createdAt: "desc" },
        include: {
          patientProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              passportPhotoUrl: true,
            },
          },
        },
      });

      if (reports.length === 0) {
        return NextResponse.json(
          {
            status: "error",
            code: "NO_REPORTS_FOUND",
            message:
              `No reports found for phone number ${normalized}. ` +
              `Make sure you used the same number when you submitted your symptoms.`,
          },
          { status: 404 }
        );
      }

      // Mark unviewed reports as viewed
      const unviewed = reports
        .filter((r) => r.status === "generated")
        .map((r) => r.id);

      if (unviewed.length > 0) {
        prisma.diagnosisReport
          .updateMany({
            where: { id: { in: unviewed } },
            data: { status: "viewed" },
          })
          .catch(() => {});
      }

      return NextResponse.json({
        status: "success",
        data: {
          lookupType: "phone",
          phone: normalized,
          totalReports: reports.length,
          reports: reports.map((r) => formatReport(r)),
        },
      });
    }

    // ── Single report lookup (ENT-code or phone-keyed ID) ─────────────────────
    const report = await prisma.diagnosisReport.findFirst({
      where: {
        OR: [
          { trackingId: decoded.toUpperCase() },
          { trackingId: decoded },
        ],
      },
      include: {
        patientProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
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
          message:
            `No report found with ID "${decoded}". ` +
            `Check the ID or try your phone number instead.`,
        },
        { status: 404 }
      );
    }

    if (report.status === "generated") {
      prisma.diagnosisReport
        .update({ where: { id: report.id }, data: { status: "viewed" } })
        .catch(() => {});
    }

    return NextResponse.json({
      status: "success",
      data: {
        lookupType: "code",
        totalReports: 1,
        reports: [formatReport(report)],
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatReport(r: {
  trackingId: string;
  phoneTrackingId: string | null;
  createdAt: Date;
  status: string;
  symptoms: string;
  affectedArea: string | null;
  duration: string | null;
  age: number | null;
  additionalContext: string | null;
  primaryConditionId: string | null;
  primaryConditionName: string | null;
  urgencyScore: number | null;
  urgencyLevel: string | null;
  referralThreshold: string | null;
  analysisResult: unknown;
  latitude: number | null;
  longitude: number | null;
  place: string | null;
  nearbyFacilities: unknown;
  pdfUrl: string | null;
  inputImageKeys: string[];
  patientProfile: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    passportPhotoUrl: string | null;
  } | null;
}) {
  return {
    trackingId: r.trackingId,
    phoneTrackingId: r.phoneTrackingId,
    createdAt: r.createdAt,
    status: r.status,
    input: {
      symptoms: r.symptoms,
      affectedArea: r.affectedArea,
      duration: r.duration,
      age: r.age,
      additionalContext: r.additionalContext,
    },
    clinical: {
      primaryConditionId: r.primaryConditionId,
      primaryConditionName: r.primaryConditionName,
      urgencyScore: r.urgencyScore,
      urgencyLevel: r.urgencyLevel,
      referralThreshold: r.referralThreshold,
    },
    analysisResult: r.analysisResult,
    location: {
      latitude: r.latitude,
      longitude: r.longitude,
      place: r.place,
    },
    nearbyFacilities: r.nearbyFacilities,
    pdfUrl: r.pdfUrl ?? null,
    patient: r.patientProfile ?? null,
    hasImages: r.inputImageKeys.length > 0,
    imageCount: r.inputImageKeys.length,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-API-Key, X-Hospital-Token",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { matchConditions, getConditionById } from "@/lib/condition-matcher";
import { extractSpecialtiesFromDiagnosis } from "@/lib/ai-matching";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyzeRequestBody {
  // Patient input
  symptoms: string;              // free-text: "ear pain, can't hear, discharge for 3 days"
  affectedArea?: "ear" | "nose" | "throat" | "head_neck";
  duration?: string;             // "3 days" | "2 weeks" | "months"
  onsetPattern?: "sudden" | "gradual" | "episodic" | "chronic";
  age?: number;
  additionalContext?: string;    // any extra info: "had a cold recently", "child aged 4"

  // Location (to find nearby specialists)
  latitude?: number;
  longitude?: number;
  place?: string;                // fallback if no coords

  // Options
  includeNearby?: boolean;       // default true — query location API
  radiusKm?: number;             // default 50
  limit?: number;                // max hospitals to return, default 5
}

interface AnalyzeResponse {
  status: "success" | "error";
  data?: {
    // Input echo
    input: {
      symptoms: string;
      affectedArea?: string;
      duration?: string;
      age?: number;
    };

    // Analysis
    analysis: {
      method: "dataset_match" | "ai_assisted" | "ai_only" | "fallback";
      confidence: "high" | "moderate" | "low";
      primaryCondition: ConditionSummary | null;
      differentials: ConditionSummary[];
      aiInsights?: {
        specialties: string[];
        services: string[];
        reasoning: string;
      } | null;
    };

    // Clinical output
    clinical: {
      urgencyScore: number;             // 1–10
      urgencyLevel: string;             // "Emergency" | "Urgent" | "Soon" | "Routine"
      urgencyColor: "red" | "orange" | "yellow" | "green";
      referralThreshold: string;
      immediateAction: string;          // what to do RIGHT NOW
      patientAdvice: string;
      redFlags: string[];               // go to A&E if any of these appear
      specialists: string[];
      investigations: string[];
      possibleCauses: string[];
      complications: string[];
    };

    // Nearby facilities (if coords provided)
    nearbyFacilities: NearbyFacility[] | null;
    locationNote: string | null;
  };
  message?: string;
}

interface ConditionSummary {
  id: string;
  name: string;
  commonName: string;
  category: string;
  confidence: number;             // 0–100
  matchedOn: string[];
}

type AnalysisMethod = "dataset_match" | "ai_assisted" | "ai_only" | "fallback";

interface NearbyFacility {
  id: string;
  name: string;
  city: string | null;
  state: string;
  distanceKm: number;
  accredited: boolean;
  specialties: string[];
  travelTimes?: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urgencyLabel(score: number): {
  level: string;
  color: "red" | "orange" | "yellow" | "green";
  action: string;
} {
  if (score >= 9)
    return {
      level: "Emergency",
      color: "red",
      action: "Go to the emergency room immediately. Do not wait.",
    };
  if (score >= 7)
    return {
      level: "Urgent",
      color: "orange",
      action: "See a doctor today or tomorrow. Do not delay.",
    };
  if (score >= 5)
    return {
      level: "Soon",
      color: "yellow",
      action: "Book an appointment with a doctor within the next few days.",
    };
  return {
    level: "Routine",
    color: "green",
    action: "Monitor symptoms and book an ENT appointment at your convenience.",
  };
}

async function fetchNearbyFacilities(
  diagnosisText: string,
  specialties: string[],
  latitude: number,
  longitude: number,
  radiusKm: number,
  limit: number,
  apiKey: string | null
): Promise<NearbyFacility[]> {
  try {
    const baseUrl =
      process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["X-API-Key"] = apiKey;

    const res = await fetch(`${baseUrl}/api/v1/match-by-diagnosis`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        latitude,
        longitude,
        diagnosis:
          diagnosisText +
          (specialties.length
            ? `. Relevant specialties: ${specialties.join(", ")}.`
            : ""),
        urgency: "routine",
        limit,
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (data.status !== "success") return [];

    return (data.data.facilities ?? []).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      name: f.name as string,
      city: f.city as string | null,
      state: f.state as string,
      distanceKm: f.distanceKm as number,
      accredited: f.accredited as boolean,
      specialties: f.specialties as string[],
      travelTimes: (f.travelEstimate ?? f.travelTimes) as Record<string, string> | undefined,
    }));
  } catch {
    return [];
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authError = await checkApiKey(req);
  if (authError) return authError;

  try {
    const body: AnalyzeRequestBody = await req.json();

    const {
      symptoms,
      affectedArea,
      duration,
      onsetPattern,
      age,
      additionalContext,
      latitude,
      longitude,
      place,
      includeNearby = true,
      radiusKm = 50,
      limit = 5,
    } = body;

    if (!symptoms || symptoms.trim().length < 3) {
      return NextResponse.json(
        { status: "error", message: "symptoms is required." },
        { status: 400 }
      );
    }

    // Build the full clinical text for AI
    const clinicalText = [
      symptoms,
      duration ? `Duration: ${duration}` : null,
      affectedArea ? `Affected area: ${affectedArea}` : null,
      age ? `Patient age: ${age}` : null,
      additionalContext || null,
    ]
      .filter(Boolean)
      .join(". ");

    // ── Step 1: Fast local dataset match ─────────────────────────────────────
    const localMatches = await matchConditions(
      clinicalText,
      affectedArea,
      onsetPattern,
      5
    );

    const topLocal = localMatches[0] ?? null;
    const hasGoodLocalMatch = topLocal && topLocal.score >= 40;

    // ── Step 2: AI analysis (always run for richer output) ───────────────────
    let aiInsights: { specialties: string[]; services: string[]; reasoning: string } | null = null;
    let analysisMethod: AnalysisMethod = "dataset_match";

    try {
      aiInsights = await extractSpecialtiesFromDiagnosis(clinicalText);
      analysisMethod = hasGoodLocalMatch ? "ai_assisted" : "ai_only";
    } catch {
      // AI unavailable — fall back to dataset only
      analysisMethod = hasGoodLocalMatch ? "dataset_match" : "fallback";
    }

    // ── Step 3: Build primary condition output ────────────────────────────────
    let primaryConditionFull = null;
    if (topLocal) {
      primaryConditionFull = await getConditionById(topLocal.conditionId);
    }

    const urgencyScore = primaryConditionFull?.urgencyScore ?? 4;
    const urgencyInfo = urgencyLabel(urgencyScore);

    // ── Step 4: Confidence ────────────────────────────────────────────────────
    const confidence =
      topLocal && topLocal.score >= 60
        ? "high"
        : topLocal && topLocal.score >= 30
        ? "moderate"
        : "low";

    // ── Step 5: Nearby facilities ─────────────────────────────────────────────
    let nearbyFacilities: NearbyFacility[] | null = null;
    let locationNote: string | null = null;
    let resolvedLat = latitude;
    let resolvedLng = longitude;

    if (includeNearby) {
      // Geocode place name if no coords
      if ((resolvedLat == null || resolvedLng == null) && place) {
        try {
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`,
            { headers: { "User-Agent": "ENT-Care-Analysis-Service/1.0" } }
          );
          const geoData = await geo.json();
          if (geoData[0]) {
            resolvedLat = parseFloat(geoData[0].lat);
            resolvedLng = parseFloat(geoData[0].lon);
          }
        } catch {
          locationNote = "Could not geocode the provided place name.";
        }
      }

      if (resolvedLat != null && resolvedLng != null) {
        const apiKey = req.headers.get("x-api-key");
        const diagnosisForSearch =
          primaryConditionFull?.name ?? symptoms;
        const specialtiesForSearch =
          aiInsights?.specialties ??
          (primaryConditionFull?.specialistNeeded ?? []);

        nearbyFacilities = await fetchNearbyFacilities(
          diagnosisForSearch,
          specialtiesForSearch,
          resolvedLat,
          resolvedLng,
          radiusKm,
          limit,
          apiKey
        );

        if (nearbyFacilities.length === 0) {
          locationNote = `No specialist facilities found within ${radiusKm}km. Consider expanding the radius or searching by city name.`;
        }
      } else if (!locationNote) {
        locationNote = "No location provided — nearby facilities not shown. Send latitude/longitude or a place name.";
      }
    }

    // ── Build response ─────────────────────────────────────────────────────────
    const primaryConditionSummary: ConditionSummary | null = topLocal
      ? {
          id: topLocal.conditionId,
          name: topLocal.name,
          commonName: topLocal.commonName,
          category: topLocal.category,
          confidence: Math.min(100, topLocal.score),
          matchedOn: [
            ...topLocal.matchedSymptoms.slice(0, 3),
            ...topLocal.matchedKeywords.slice(0, 2),
          ],
        }
      : null;

    const differentials: ConditionSummary[] = localMatches
      .slice(1, 4)
      .map((m) => ({
        id: m.conditionId,
        name: m.name,
        commonName: m.commonName,
        category: m.category,
        confidence: Math.min(100, m.score),
        matchedOn: [...m.matchedSymptoms.slice(0, 2), ...m.matchedKeywords.slice(0, 1)],
      }));

    const response: AnalyzeResponse = {
      status: "success",
      data: {
        input: {
          symptoms,
          affectedArea,
          duration,
          age,
        },
        analysis: {
          method: analysisMethod,
          confidence,
          primaryCondition: primaryConditionSummary,
          differentials,
          aiInsights,
        },
        clinical: {
          urgencyScore,
          urgencyLevel: urgencyInfo.level,
          urgencyColor: urgencyInfo.color,
          referralThreshold:
            primaryConditionFull?.referralThreshold ?? "routine",
          immediateAction: urgencyInfo.action,
          patientAdvice:
            primaryConditionFull?.patientAdvice ??
            "Please consult a healthcare provider for a proper evaluation.",
          redFlags:
            primaryConditionFull?.redFlags ??
            (aiInsights ? [] : ["If symptoms worsen significantly, seek immediate medical care."]),
          specialists:
            primaryConditionFull?.specialistNeeded ??
            aiInsights?.specialties ?? ["ENT"],
          investigations: primaryConditionFull
            ? [
                ...((primaryConditionFull.investigations as { clinical?: string[] })?.clinical ?? []),
                ...((primaryConditionFull.investigations as { specialist?: string[] })?.specialist ?? []),
              ].slice(0, 4)
            : [],
          possibleCauses: primaryConditionFull
            ? [
                ...((primaryConditionFull.causes as { primary?: string[] })?.primary ?? []).slice(0, 3),
                ...((primaryConditionFull.causes as { contributing?: string[] })?.contributing ?? []).slice(0, 2),
              ]
            : [],
          complications: (primaryConditionFull?.complications ?? []).slice(0, 4),
        },
        nearbyFacilities,
        locationNote,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/v1/analyze]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    },
  });
}

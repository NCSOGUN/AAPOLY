import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineDistance, formatDuration, estimateTravelMinutes } from "@/lib/haversine";
import { AIProviderError, extractSpecialtiesFromDiagnosis } from "@/lib/ai-matching";
import {
  EXTERNAL_FACILITY_SEARCH_RADIUS_KM,
  MAX_EXTERNAL_FACILITY_SEARCH_RADIUS_KM,
  ExternalFacility,
  searchExternalFacilities,
} from "@/lib/external-facilities";

export const maxDuration = 30;

interface MatchRequestBody {
  latitude: number;
  longitude: number;
  diagnosis: string;
  urgency?: "routine" | "priority" | "emergency";
  limit?: number;
}

interface ValidatedMatchRequest {
  latitude: number;
  longitude: number;
  diagnosis: string;
  urgency: "routine" | "priority" | "emergency";
  limit: number;
}

async function nearbyFallbackResponse(
  request: ValidatedMatchRequest,
  matchingStatus: "unavailable" | "no_relevant_specialty",
  aiExtraction: Awaited<ReturnType<typeof extractSpecialtiesFromDiagnosis>> | null,
  reason: string
) {
  const radiusKm = MAX_EXTERNAL_FACILITY_SEARCH_RADIUS_KM;
  const registryFacilities = await prisma.facility.findMany({
    include: {
      specialties: { include: { specialty: true } },
      services: true,
    },
  });
  const registryResults = registryFacilities
    .map((facility) => ({
      facility,
      distanceKm: haversineDistance(
        request.latitude,
        request.longitude,
        facility.latitude,
        facility.longitude
      ),
    }))
    .filter((result) => result.distanceKm <= radiusKm)
    .map(({ facility, distanceKm }) => ({
      id: facility.id,
      name: facility.name,
      slug: facility.slug,
      address: facility.address,
      city: facility.city,
      state: facility.state,
      country: facility.country,
      latitude: facility.latitude,
      longitude: facility.longitude,
      phone: facility.phone,
      email: facility.email,
      website: facility.website,
      accredited: facility.accredited,
      accreditationStatus: facility.accredited
        ? ("accredited" as const)
        : ("not_accredited" as const),
      source: "internal_registry" as const,
      verificationStatus: "registry_record" as const,
      matchStatus: "not_assessed" as const,
      specialties: facility.specialties.map((item) => item.specialty.name),
      services: facility.services
        .filter((service) => service.available)
        .map((service) => service.name),
      matchedSpecialties: [],
      matchedServices: [],
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      travelEstimate: {
        driving: formatDuration(estimateTravelMinutes(distanceKm, 50)),
        walking: formatDuration(estimateTravelMinutes(distanceKm, 5)),
        motorcycle: formatDuration(estimateTravelMinutes(distanceKm, 75)),
      },
    }));

  let externalFacilities: ExternalFacility[] = [];
  let externalSearchStatus: "available" | "unavailable" = "available";
  try {
    externalFacilities = await searchExternalFacilities(
      request.latitude,
      request.longitude,
      [],
      radiusKm
    );
  } catch (error) {
    externalSearchStatus = "unavailable";
    console.error("[OpenStreetMap] nearby fallback search failed:", error);
  }

  const deduplicatedExternal = externalFacilities.filter((external) =>
    !registryResults.some((internal) => {
      const sameName =
        internal.name.trim().toLowerCase() === external.name.trim().toLowerCase();
      return (
        sameName &&
        haversineDistance(
          internal.latitude,
          internal.longitude,
          external.latitude,
          external.longitude
        ) <= 0.5
      );
    })
  );
  const facilities = [...registryResults, ...deduplicatedExternal]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, request.limit);

  if (facilities.length === 0 && externalSearchStatus === "unavailable") {
    return NextResponse.json(
      {
        status: "error",
        message: "AI matching is unavailable and nearby facility search could not be completed.",
        code: "MATCHING_AND_FACILITY_SEARCH_UNAVAILABLE",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: "success",
    data: {
      userLocation: {
        latitude: request.latitude,
        longitude: request.longitude,
      },
      diagnosis: request.diagnosis,
      urgency: request.urgency,
      matchingMode: "nearby_fallback",
      diagnosisMatching: {
        status: matchingStatus,
        message: reason,
      },
      aiExtraction,
      externalSearch: {
        source: "OpenStreetMap Nominatim",
        attribution: "© OpenStreetMap contributors",
        geographicScope: "Nigeria",
        radiusKm,
        status: externalSearchStatus,
        facilitiesFound: externalFacilities.length,
      },
      total: facilities.length,
      facilities,
    },
  });
}

export async function POST(req: NextRequest) {
  let validatedRequest: ValidatedMatchRequest | null = null;
  try {
    const body: MatchRequestBody = await req.json();
    const { latitude, longitude, diagnosis, urgency = "routine", limit = 10 } = body;

    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { status: "error", message: "Valid latitude and longitude are required." },
        { status: 400 }
      );
    }

    if (
      typeof diagnosis !== "string" ||
      diagnosis.trim().length === 0 ||
      diagnosis.length > 4000
    ) {
      return NextResponse.json(
        { status: "error", message: "diagnosis must contain 1 to 4000 characters." },
        { status: 400 }
      );
    }

    if (!["routine", "priority", "emergency"].includes(urgency)) {
      return NextResponse.json(
        { status: "error", message: "urgency must be routine, priority, or emergency." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { status: "error", message: "limit must be an integer between 1 and 50." },
        { status: 400 }
      );
    }

    validatedRequest = {
      latitude,
      longitude,
      diagnosis: diagnosis.trim(),
      urgency,
      limit,
    };
    const extraction = await extractSpecialtiesFromDiagnosis(diagnosis.trim());
    if (extraction.specialties.length === 0) {
      return nearbyFallbackResponse(
        validatedRequest,
        "no_relevant_specialty",
        extraction,
        "AI did not identify a matching specialty. These are nearby facilities, not diagnosis-matched recommendations."
      );
    }

    // Include all registry matches; accreditation affects rank, not inclusion.
    const candidates = await prisma.facility.findMany({
      where: {
        specialties: {
          some: {
            specialty: {
              name: {
                in: extraction.specialties,
                mode: "insensitive",
              },
            },
          },
        },
      },
      include: {
        specialties: { include: { specialty: true } },
        services: true,
      },
    });

    // Calculate distances and relevance scores
    const scored = candidates.map((f) => {
      const distanceKm = haversineDistance(latitude, longitude, f.latitude, f.longitude);

      // Relevance: how many extracted specialties match
      const facilitySpecialties = f.specialties.map((s) =>
        s.specialty.name.toLowerCase()
      );
      const matchedSpecialties = extraction.specialties.filter((s) =>
        facilitySpecialties.includes(s.toLowerCase())
      );
      const availableServices = f.services.filter((service) => service.available);
      const facilityServiceNames = new Set(
        availableServices.map((service) => service.name.trim().toLowerCase())
      );
      const matchedServices = extraction.services.filter((service) =>
        facilityServiceNames.has(service.trim().toLowerCase())
      );

      // Exact service matches add relevance without excluding specialty matches.
      const relevanceScore =
        matchedSpecialties.length * 10 +
        matchedServices.length * 5 +
        (f.accredited ? 5 : 0);

      // Combined score (higher is better): relevance minus distance penalty
      const combinedScore = relevanceScore - distanceKm * 0.1;

      return {
        ...f,
        distanceKm,
        matchedSpecialties,
        matchedServices,
        relevanceScore,
        combinedScore,
      };
    });

    // Sort: emergency = by distance only, otherwise by combined score
    scored.sort((a, b) => {
      if (urgency === "emergency") return a.distanceKm - b.distanceKm;
      return b.combinedScore - a.combinedScore;
    });

    const results = scored.map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      address: f.address,
      city: f.city,
      state: f.state,
      country: f.country,
      latitude: f.latitude,
      longitude: f.longitude,
      phone: f.phone,
      email: f.email,
      website: f.website,
      accredited: f.accredited,
      specialties: f.specialties.map((s) => s.specialty.name),
      services: f.services.filter((s) => s.available).map((s) => s.name),
      matchedSpecialties: f.matchedSpecialties,
      matchedServices: f.matchedServices,
      source: "internal_registry" as const,
      verificationStatus: "registry_record" as const,
      accreditationStatus: f.accredited ? "accredited" as const : "not_accredited" as const,
      matchStatus: "specialty_match" as const,
      relevanceScore: f.relevanceScore,
      combinedScore: f.combinedScore,
      distanceKm: parseFloat(f.distanceKm.toFixed(2)),
      travelEstimate: {
        driving: formatDuration(estimateTravelMinutes(f.distanceKm, 50)),
        walking: formatDuration(estimateTravelMinutes(f.distanceKm, 5)),
        motorcycle: formatDuration(estimateTravelMinutes(f.distanceKm, 75)),
      },
    }));

    let externalFacilities: ExternalFacility[] = [];
    let externalSearchStatus: "available" | "unavailable" = "available";
    try {
      externalFacilities = await searchExternalFacilities(
        latitude,
        longitude,
        extraction.specialties
      );
    } catch (error) {
      externalSearchStatus = "unavailable";
      console.error("[OpenStreetMap] external facility search failed:", error);
    }

    const nonDuplicateExternalFacilities = externalFacilities.filter((external) =>
      !results.some((internal) => {
        const sameName =
          internal.name.trim().toLowerCase() === external.name.trim().toLowerCase();
        return (
          sameName &&
          haversineDistance(
            internal.latitude,
            internal.longitude,
            external.latitude,
            external.longitude
          ) <= 0.5
        );
      })
    );

    const rankedResults = [
      ...results.map(({ relevanceScore: _relevanceScore, combinedScore, ...facility }) => ({
        facility,
        distanceKm: facility.distanceKm,
        score: combinedScore,
      })),
      ...nonDuplicateExternalFacilities.map((facility) => ({
        facility,
        distanceKm: facility.distanceKm,
        score:
          facility.matchedSpecialties.length * 10 -
          facility.distanceKm * 0.1,
      })),
    ];
    rankedResults.sort((a, b) =>
      urgency === "emergency"
        ? a.distanceKm - b.distanceKm
        : b.score - a.score
    );

    const finalFacilities = rankedResults
      .slice(0, limit)
      .map(({ facility }) => facility);

    if (externalSearchStatus === "unavailable" && finalFacilities.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "External facility search is unavailable and no registry matches were found.",
          code: "EXTERNAL_FACILITY_SEARCH_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "success",
      data: {
        userLocation: { latitude, longitude },
        diagnosis,
        urgency,
        matchingMode: "diagnosis_matched",
        diagnosisMatching: {
          status: "completed",
        },
        aiExtraction: extraction,
        externalSearch: {
          source: "OpenStreetMap Nominatim",
          attribution: "© OpenStreetMap contributors",
          geographicScope: "Nigeria",
          radiusKm: EXTERNAL_FACILITY_SEARCH_RADIUS_KM,
          status: externalSearchStatus,
          facilitiesFound: externalFacilities.length,
        },
        total: finalFacilities.length,
        facilities: finalFacilities,
      },
    });
  } catch (err) {
    if (err instanceof AIProviderError && validatedRequest) {
      try {
        return await nearbyFallbackResponse(
          validatedRequest,
          "unavailable",
          null,
          "AI matching is unavailable. These are nearby facilities, not diagnosis-matched recommendations."
        );
      } catch (fallbackError) {
        console.error("[/api/v1/match-by-diagnosis] nearby fallback failed:", fallbackError);
        return NextResponse.json(
          {
            status: "error",
            message: "AI matching is unavailable and nearby facility search failed.",
            code: "MATCHING_AND_FACILITY_SEARCH_UNAVAILABLE",
          },
          { status: 503 }
        );
      }
    }

    if (err instanceof AIProviderError) {
      return NextResponse.json(
        {
          status: "error",
          message: err.message,
          code:
            err.statusCode === 503
              ? "AI_MATCHING_UNAVAILABLE"
              : "AI_MATCHING_FAILED",
        },
        { status: err.statusCode }
      );
    }

    console.error("[/api/v1/match-by-diagnosis]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

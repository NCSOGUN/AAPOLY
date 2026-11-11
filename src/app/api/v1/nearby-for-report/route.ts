import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { haversineDistance, estimateTravelMinutes, formatDuration } from "@/lib/haversine";
import { geocode } from "@/lib/geocoding";
import { getTravelTimes } from "@/lib/routing";

/**
 * POST /api/v1/nearby-for-report
 *
 * Takes the key outputs of an analysis report and finds the best matching
 * hospitals. This is the endpoint the "Find Nearby Hospital" button calls.
 *
 * The caller passes what they need from the report — this endpoint decides
 * how to rank and filter. No AI call needed here.
 */

interface NearbyForReportBody {
  // From the analysis report
  primaryCondition: string;       // e.g. "Acute Otitis Media"
  specialists: string[];          // e.g. ["ENT", "Paediatric ENT"]
  urgencyScore: number;           // 1–10 — drives sort strategy
  requiredServices?: string[];    // e.g. ["Audiometry", "Tympanometry"] (optional)

  // User location
  latitude?: number;
  longitude?: number;
  place?: string;                 // geocoded if no coords

  // Options
  radiusKm?: number;              // default 50
  limit?: number;                 // default 8
  onlyAccredited?: boolean;       // default true
}

export async function POST(req: NextRequest) {
  const authError = await checkApiKey(req);
  if (authError) return authError;

  try {
    const body: NearbyForReportBody = await req.json();

    const {
      primaryCondition,
      specialists = [],
      urgencyScore = 5,
      requiredServices = [],
      radiusKm = 50,
      limit = 8,
      onlyAccredited = true,
    } = body;

    if (!primaryCondition) {
      return NextResponse.json(
        { status: "error", message: "primaryCondition is required." },
        { status: 400 }
      );
    }

    // ── Resolve coordinates ───────────────────────────────────────────────────
    let latitude = body.latitude;
    let longitude = body.longitude;

    if ((latitude == null || longitude == null) && body.place) {
      const geo = await geocode(body.place);
      if (geo) {
        latitude = geo.lat;
        longitude = geo.lng;
      }
    }

    if (latitude == null || longitude == null) {
      return NextResponse.json(
        { status: "error", message: "Provide latitude/longitude or a place name." },
        { status: 400 }
      );
    }

    // ── Query facilities ──────────────────────────────────────────────────────
    // Build specialty filter — match any of the required specialists
    const specialtyFilter = specialists.length > 0
      ? {
          specialties: {
            some: {
              specialty: {
                name: { in: specialists, mode: "insensitive" as const },
              },
            },
          },
        }
      : {};

    const facilities = await prisma.facility.findMany({
      where: {
        ...(onlyAccredited ? { accredited: true } : {}),
        ...specialtyFilter,
      },
      include: {
        specialties: { include: { specialty: true } },
        services: { where: { available: true } },
      },
    });

    // ── Distance filter ───────────────────────────────────────────────────────
    const withDistance = facilities
      .map((f) => ({
        ...f,
        distanceKm: haversineDistance(latitude!, longitude!, f.latitude, f.longitude),
      }))
      .filter((f) => f.distanceKm <= radiusKm);

    // ── Score each facility ───────────────────────────────────────────────────
    const scored = withDistance.map((f) => {
      const facilitySpecialties = f.specialties.map((s) =>
        s.specialty.name.toLowerCase()
      );
      const facilityServices = f.services.map((s) => s.name.toLowerCase());

      // Specialty match score
      const matchedSpecialties = specialists.filter((s) =>
        facilitySpecialties.includes(s.toLowerCase())
      );
      const specialtyScore = matchedSpecialties.length * 25;

      // Service match score
      const matchedServices = requiredServices.filter((s) =>
        facilityServices.some((fs) => fs.includes(s.toLowerCase()))
      );
      const serviceScore = matchedServices.length * 15;

      // Accreditation bonus
      const accreditationBonus = f.accredited ? 20 : 0;

      // Distance penalty (closer = better)
      const distancePenalty = f.distanceKm * 0.5;

      const totalScore =
        specialtyScore + serviceScore + accreditationBonus - distancePenalty;

      return {
        ...f,
        matchedSpecialties,
        matchedServices,
        relevanceScore: totalScore,
      };
    });

    // ── Sort strategy based on urgency ────────────────────────────────────────
    // Emergency (9-10): pure distance — closest hospital first
    // Urgent (7-8): distance weighted heavily
    // Soon (5-6): balanced relevance + distance
    // Routine (1-4): relevance first, then distance
    if (urgencyScore >= 9) {
      scored.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (urgencyScore >= 7) {
      scored.sort((a, b) => a.distanceKm * 2 - b.distanceKm * 2 + (b.relevanceScore - a.relevanceScore));
    } else {
      scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    const top = scored.slice(0, limit);

    // ── Get travel times for top 5 ────────────────────────────────────────────
    const results = await Promise.all(
      top.map(async (f, i) => {
        let travelTimes: { driving: string; walking: string; motorcycle: string };

        if (i < 5) {
          travelTimes = await getTravelTimes(
            latitude!,
            longitude!,
            f.latitude,
            f.longitude
          );
        } else {
          travelTimes = {
            driving: formatDuration(estimateTravelMinutes(f.distanceKm, 50)),
            walking: formatDuration(estimateTravelMinutes(f.distanceKm, 5)),
            motorcycle: formatDuration(estimateTravelMinutes(f.distanceKm, 75)),
          };
        }

        return {
          id: f.id,
          name: f.name,
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
          services: f.services.map((s) => s.name),
          matchedSpecialties: f.matchedSpecialties,
          matchedServices: f.matchedServices,
          distanceKm: parseFloat(f.distanceKm.toFixed(2)),
          relevanceScore: Math.round(f.relevanceScore),
          travelTimes,
        };
      })
    );

    // ── Build sorting explanation ─────────────────────────────────────────────
    const sortNote =
      urgencyScore >= 9
        ? "Sorted by distance — closest first (emergency mode)."
        : urgencyScore >= 7
        ? "Sorted by distance + specialty match (urgent mode)."
        : "Sorted by specialty relevance + distance (standard mode).";

    return NextResponse.json({
      status: "success",
      data: {
        query: {
          primaryCondition,
          specialists,
          urgencyScore,
          requiredServices,
          userLocation: { latitude, longitude },
          radiusKm,
          sortNote,
        },
        total: results.length,
        facilities: results,
      },
    });
  } catch (err) {
    console.error("[/api/v1/nearby-for-report]", err);
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

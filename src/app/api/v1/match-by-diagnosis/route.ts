import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineDistance, formatDuration, estimateTravelMinutes } from "@/lib/haversine";
import { extractSpecialtiesFromDiagnosis } from "@/lib/gemini";

interface MatchRequestBody {
  latitude: number;
  longitude: number;
  diagnosis: string;
  urgency?: "routine" | "priority" | "emergency";
  limit?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: MatchRequestBody = await req.json();
    const { latitude, longitude, diagnosis, urgency = "routine", limit = 10 } = body;

    if (!latitude || !longitude) {
      return NextResponse.json(
        { status: "error", message: "latitude and longitude are required." },
        { status: 400 }
      );
    }

    if (!diagnosis || typeof diagnosis !== "string" || diagnosis.trim().length === 0) {
      return NextResponse.json(
        { status: "error", message: "diagnosis is required." },
        { status: 400 }
      );
    }

    // Extract specialties and services from diagnosis via Gemini
    const extraction = await extractSpecialtiesFromDiagnosis(diagnosis.trim());

    // Fetch facilities matching extracted specialties
    const facilities = await prisma.facility.findMany({
      where: {
        accredited: true,
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

    // If no accredited matches found, broaden to all facilities with matching specialties
    let candidates = facilities;
    if (candidates.length === 0) {
      const broader = await prisma.facility.findMany({
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
      candidates = broader;
    }

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

      // Relevance score: matched specialties count + accreditation bonus
      const relevanceScore =
        matchedSpecialties.length * 10 + (f.accredited ? 5 : 0);

      // Combined score (higher is better): relevance minus distance penalty
      const combinedScore = relevanceScore - distanceKm * 0.1;

      return {
        ...f,
        distanceKm,
        matchedSpecialties,
        relevanceScore,
        combinedScore,
      };
    });

    // Sort: emergency = by distance only, otherwise by combined score
    scored.sort((a, b) => {
      if (urgency === "emergency") return a.distanceKm - b.distanceKm;
      return b.combinedScore - a.combinedScore;
    });

    const results = scored.slice(0, limit).map((f) => ({
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
      distanceKm: parseFloat(f.distanceKm.toFixed(2)),
      travelEstimate: {
        driving: formatDuration(estimateTravelMinutes(f.distanceKm, 50)),
        walking: formatDuration(estimateTravelMinutes(f.distanceKm, 5)),
        motorcycle: formatDuration(estimateTravelMinutes(f.distanceKm, 75)),
      },
    }));

    return NextResponse.json({
      status: "success",
      data: {
        userLocation: { latitude, longitude },
        diagnosis,
        urgency,
        aiExtraction: extraction,
        total: results.length,
        facilities: results,
      },
    });
  } catch (err) {
    console.error("[/api/v1/match-by-diagnosis]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

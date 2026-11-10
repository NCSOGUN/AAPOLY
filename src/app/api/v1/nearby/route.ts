import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineDistance } from "@/lib/haversine";
import { geocode } from "@/lib/geocoding";
import { getTravelTimes } from "@/lib/routing";

interface NearbyRequestBody {
  latitude?: number;
  longitude?: number;
  place?: string;
  radiusKm?: number;
  specialty?: string;
  services?: string[];
  onlyAccredited?: boolean;
  limit?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: NearbyRequestBody = await req.json();

    let { latitude, longitude } = body;
    const {
      place,
      radiusKm = 50,
      specialty,
      onlyAccredited = false,
      limit = 10,
    } = body;

    // Geocode place name if coordinates not provided
    if ((latitude == null || longitude == null) && place) {
      const geo = await geocode(place);
      if (!geo) {
        return NextResponse.json(
          { status: "error", message: `Could not geocode place: "${place}"` },
          { status: 422 }
        );
      }
      latitude = geo.lat;
      longitude = geo.lng;
    }

    if (latitude == null || longitude == null) {
      return NextResponse.json(
        {
          status: "error",
          message: "Provide either latitude/longitude or a place name.",
        },
        { status: 400 }
      );
    }

    // Fetch facilities with their specialties
    const facilities = await prisma.facility.findMany({
      where: onlyAccredited ? { accredited: true } : undefined,
      include: {
        specialties: { include: { specialty: true } },
        services: true,
      },
    });

    // Filter by distance
    let nearby = facilities
      .map((f) => ({
        ...f,
        distanceKm: haversineDistance(latitude!, longitude!, f.latitude, f.longitude),
      }))
      .filter((f) => f.distanceKm <= radiusKm);

    // Filter by specialty
    if (specialty) {
      nearby = nearby.filter((f) =>
        f.specialties.some(
          (s) => s.specialty.name.toLowerCase() === specialty.toLowerCase()
        )
      );
    }

    // Sort by distance
    nearby.sort((a, b) => a.distanceKm - b.distanceKm);

    // Cap to limit
    const capped = nearby.slice(0, limit);

    // Get travel times for top 5, estimate for the rest
    const withTravel = await Promise.all(
      capped.map(async (f, index) => {
        let travelTimes;
        if (index < 5) {
          travelTimes = await getTravelTimes(
            latitude!,
            longitude!,
            f.latitude,
            f.longitude
          );
        } else {
          // Estimate only
          const { formatDuration, estimateTravelMinutes } = await import(
            "@/lib/haversine"
          );
          travelTimes = {
            driving: formatDuration(estimateTravelMinutes(f.distanceKm, 50)),
            walking: formatDuration(estimateTravelMinutes(f.distanceKm, 5)),
            motorcycle: formatDuration(estimateTravelMinutes(f.distanceKm, 75)),
          };
        }

        return {
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
          accreditationDate: f.accreditationDate,
          specialties: f.specialties.map((s) => s.specialty.name),
          services: f.services
            .filter((s) => s.available)
            .map((s) => s.name),
          distanceKm: parseFloat(f.distanceKm.toFixed(2)),
          travelTimes,
        };
      })
    );

    return NextResponse.json({
      status: "success",
      data: {
        userLocation: { latitude, longitude },
        radiusKm,
        total: withTravel.length,
        facilities: withTravel,
      },
    });
  } catch (err) {
    console.error("[/api/v1/nearby]", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

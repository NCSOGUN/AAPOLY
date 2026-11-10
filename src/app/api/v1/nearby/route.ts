import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineDistance } from "@/lib/haversine";
import { geocode, reverseGeocode } from "@/lib/geocoding";
import { getTravelTimes } from "@/lib/routing";
import { checkApiKey } from "@/lib/api-auth";
import {
  ExternalFacility,
  searchExternalFacilities,
} from "@/lib/external-facilities";

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
  const authError = checkApiKey(req);
  if (authError) return authError;
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

    if (
      (latitude !== undefined &&
        (typeof latitude !== "number" ||
          !Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90)) ||
      (longitude !== undefined &&
        (typeof longitude !== "number" ||
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180))
    ) {
      return NextResponse.json(
        { status: "error", message: "Coordinates must be valid latitude and longitude numbers." },
        { status: 400 }
      );
    }

    if (
      typeof radiusKm !== "number" ||
      !Number.isFinite(radiusKm) ||
      radiusKm <= 0 ||
      radiusKm > 500
    ) {
      return NextResponse.json(
        { status: "error", message: "radiusKm must be a number greater than 0 and no more than 500." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { status: "error", message: "limit must be an integer between 1 and 50." },
        { status: 400 }
      );
    }

    if (
      body.services !== undefined &&
      (!Array.isArray(body.services) ||
        body.services.some(
          (service) => typeof service !== "string" || service.trim().length === 0
        ))
    ) {
      return NextResponse.json(
        { status: "error", message: "services must be an array of non-empty strings." },
        { status: 400 }
      );
    }

    // Geocode place name if coordinates not provided
    if ((latitude == null || longitude == null) && place) {
      if (typeof place !== "string" || place.trim().length === 0) {
        return NextResponse.json(
          { status: "error", message: "place must be a non-empty string." },
          { status: 400 }
        );
      }

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

    const userLocationDetails = await reverseGeocode(latitude, longitude);

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

    // Match every requested service, ignoring case and unavailable services.
    if (body.services?.length) {
      const requestedServices = body.services.map((service) =>
        service.trim().toLowerCase()
      );
      nearby = nearby.filter((facility) => {
        const availableServices = facility.services
          .filter((service) => service.available)
          .map((service) => service.name.toLowerCase());
        return requestedServices.every((service) =>
          availableServices.includes(service)
        );
      });
    }

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
          accreditationStatus: f.accredited ? "accredited" as const : "not_accredited" as const,
          source: "internal_registry" as const,
          verificationStatus: "registry_record" as const,
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

    let externalFacilities: ExternalFacility[] = [];
    let externalSearchStatus:
      | "available"
      | "unavailable"
      | "excluded_by_filters" = "available";

    if (onlyAccredited || specialty || body.services?.length) {
      externalSearchStatus = "excluded_by_filters";
    } else {
      try {
        externalFacilities = await searchExternalFacilities(
          latitude,
          longitude,
          [],
          Math.min(radiusKm, 50)
        );
      } catch (error) {
        externalSearchStatus = "unavailable";
        console.error("[OpenStreetMap] nearby facility search failed:", error);
      }
    }

    const nonDuplicateExternalFacilities = externalFacilities.filter((external) =>
      !withTravel.some((internal) => {
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
    const externalNearbyFacilities = nonDuplicateExternalFacilities.map(
      ({ travelEstimate, ...facility }) => ({
        ...facility,
        travelTimes: travelEstimate,
      })
    );

    const combinedFacilities = [
      ...withTravel,
      ...externalNearbyFacilities,
    ]
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return NextResponse.json({
      status: "success",
      data: {
        userLocation: {
          latitude,
          longitude,
          addressStatus: userLocationDetails ? "resolved" : "unavailable",
          address: userLocationDetails
            ? {
                formatted: userLocationDetails.displayName,
                ...userLocationDetails.address,
              }
            : null,
        },
        radiusKm,
        externalSearch: {
          source: "OpenStreetMap Nominatim",
          attribution: "© OpenStreetMap contributors",
          geographicScope: "Nigeria",
          radiusKm: Math.min(radiusKm, 50),
          status: externalSearchStatus,
          facilitiesFound: externalFacilities.length,
        },
        total: combinedFacilities.length,
        facilities: combinedFacilities,
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

// Handle CORS preflight
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

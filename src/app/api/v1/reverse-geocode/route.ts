import { NextRequest, NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/geocoding";
import { checkApiKey } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authError = await checkApiKey(req);
  if (authError) return authError;

  const rawLatitude = req.nextUrl.searchParams.get("latitude");
  const rawLongitude = req.nextUrl.searchParams.get("longitude");

  if (rawLatitude === null || rawLongitude === null) {
    return NextResponse.json(
      {
        status: "error",
        message: "latitude and longitude query parameters are required.",
      },
      { status: 400 }
    );
  }

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "latitude must be between -90 and 90, and longitude must be between -180 and 180.",
      },
      { status: 400 }
    );
  }

  try {
    const address = await reverseGeocode(latitude, longitude);
    if (!address) {
      return NextResponse.json(
        {
          status: "error",
          message: "Address could not be resolved for these coordinates.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "success",
      data: {
        latitude,
        longitude,
        address: {
          formatted: address.displayName,
          ...address.address,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/v1/reverse-geocode]", error);
    return NextResponse.json(
      { status: "error", message: "Address lookup failed." },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    },
  });
}

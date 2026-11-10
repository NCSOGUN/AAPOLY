import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { geocode, reverseGeocode } from "@/lib/geocoding";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q")?.trim();
  const rawLatitude = searchParams.get("latitude");
  const rawLongitude = searchParams.get("longitude");

  try {
    if (query) {
      const location = await geocode(query);
      if (!location) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "No matching place was found in the map data. Try adding the town, LGA, or state (for example, “Aapoly, Ijebu-Igbo, Ogun”), or click the map and place the pin manually.",
          },
          { status: 422 }
        );
      }

      return NextResponse.json({ status: "success", data: location });
    }

    const latitude = rawLatitude === null ? Number.NaN : Number(rawLatitude);
    const longitude = rawLongitude === null ? Number.NaN : Number(rawLongitude);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { status: "error", message: "Provide a search query or valid coordinates." },
        { status: 400 }
      );
    }

    const location = await reverseGeocode(latitude, longitude);
    if (!location) {
      return NextResponse.json(
        { status: "error", message: "Address details could not be resolved for this point." },
        { status: 422 }
      );
    }

    return NextResponse.json({ status: "success", data: location });
  } catch (error) {
    console.error("[GET /api/admin/location]", error);
    return NextResponse.json(
      { status: "error", message: "Location lookup failed." },
      { status: 502 }
    );
  }
}

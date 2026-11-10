const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ENT-Care-Location-Service/1.0";

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName?: string;
}

export interface ReverseGeocodingResult {
  displayName: string;
  address: {
    houseNumber: string | null;
    road: string | null;
    neighbourhood: string | null;
    town: string | null;
    lga: string | null;
    state: string | null;
    postcode: string | null;
    country: string | null;
    countryCode: string | null;
  };
}

/**
 * Geocode a place name to lat/lng using Nominatim (OpenStreetMap).
 * Returns null if the place cannot be found.
 */
export async function geocode(place: string): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      q: place,
      format: "json",
      limit: "1",
      countrycodes: "ng",
    });

    const url = `${NOMINATIM_BASE}/search?${params.toString()}`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 0 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0];
    return {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      displayName: first.display_name,
    };
  } catch {
    return null;
  }
}

/**
 * Reverse-geocode lat/lng to a human-readable address using Nominatim.
 * Returns null on failure.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: "json",
      addressdetails: "1",
    });

    const url = `${NOMINATIM_BASE}/reverse?${params.toString()}`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 0 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (typeof data?.display_name !== "string" || !data.address) return null;

    const address = data.address as Record<string, unknown>;
    const getAddressPart = (...keys: string[]) => {
      for (const key of keys) {
        const value = address[key];
        if (typeof value === "string" && value.length > 0) return value;
      }
      return null;
    };

    return {
      displayName: data.display_name,
      address: {
        houseNumber: getAddressPart("house_number"),
        road: getAddressPart("road", "pedestrian", "footway"),
        neighbourhood: getAddressPart("neighbourhood", "suburb", "quarter"),
        town: getAddressPart("city", "town", "village", "municipality", "hamlet"),
        lga: getAddressPart("state_district", "county", "municipality"),
        state: getAddressPart("state"),
        postcode: getAddressPart("postcode"),
        country: getAddressPart("country"),
        countryCode: getAddressPart("country_code"),
      },
    };
  } catch {
    return null;
  }
}

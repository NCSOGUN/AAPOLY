const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ENT-Care-Location-Service/1.0";

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName?: string;
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
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: "json",
    });

    const url = `${NOMINATIM_BASE}/reverse?${params.toString()}`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 0 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.display_name ?? null;
  } catch {
    return null;
  }
}

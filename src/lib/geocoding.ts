import { fetchNominatim } from "@/lib/nominatim";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const PHOTON_BASE = "https://photon.komoot.io/api/";
const USER_AGENT = "ENT-Care-Location-Service/1.0";

type PhotonFeature = {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: {
    countrycode?: unknown;
    country?: unknown;
    name?: unknown;
    city?: unknown;
    district?: unknown;
    county?: unknown;
    state?: unknown;
  };
};

function isCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function queryTokens(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1);
}

function getPhotonFallback(
  features: PhotonFeature[],
  query: string
): GeocodingResult | null {
  const queryWords = queryTokens(query).filter(
    (word) => !["nigeria", "ogun", "state", "country"].includes(word)
  );

  const candidates = features.flatMap((feature) => {
    const properties = feature.properties;
    const coordinates = feature.geometry?.coordinates;
    if (!properties || !isCoordinatePair(coordinates)) return [];
    if (
      properties.countrycode !== "NG" &&
      properties.countrycode !== "ng" &&
      properties.country !== "Nigeria"
    ) {
      return [];
    }

    const name =
      typeof properties.name === "string" ? properties.name : undefined;
    const searchableText = queryTokens(
      [
        name,
        properties.city,
        properties.district,
        properties.county,
        properties.state,
      ]
        .filter((part): part is string => typeof part === "string")
        .join(" ")
    );
    const matchedWords = queryWords.filter((word) =>
      searchableText.includes(word)
    );

    // Keep multi-word searches relevant while allowing an unlisted facility name
    // to resolve to a matching town or neighbourhood in the query.
    if (
      queryWords.length > 1 &&
      matchedWords.length < Math.ceil(queryWords.length * 0.6)
    ) {
      return [];
    }

    return [
      {
        lat: coordinates[1],
        lng: coordinates[0],
        displayName: [
          name,
          properties.city,
          properties.county,
          properties.state,
          properties.country,
        ]
          .filter((part): part is string => typeof part === "string")
          .filter((part, index, parts) => parts.indexOf(part) === index)
          .join(", "),
        score: matchedWords.length,
      },
    ];
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

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
    components: Record<string, string>;
  };
}

/**
 * Geocode a place name using Nominatim, then fall back to Photon.
 * Returns null when neither provider has a sufficiently relevant Nigerian result.
 */
export async function geocode(place: string): Promise<GeocodingResult | null> {
  const params = new URLSearchParams({
    q: place,
    format: "jsonv2",
    limit: "1",
    countrycodes: "ng",
  });

  try {
    const url = `${NOMINATIM_BASE}/search?${params.toString()}`;
    const response = await fetchNominatim(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error(`Nominatim search returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      const lat = Number(first.lat);
      const lng = Number(first.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          lat,
          lng,
          displayName:
            typeof first.display_name === "string"
              ? first.display_name
              : undefined,
        };
      }
    }
  } catch (error) {
    console.warn("[Geocoding] Nominatim search failed; trying Photon:", error);
  }

  const photonParams = new URLSearchParams({
    q: place,
    limit: "10",
    lang: "en",
  });
  const photonResponse = await fetch(`${PHOTON_BASE}?${photonParams}`, {
    next: { revalidate: 86400 },
  });
  if (!photonResponse.ok) {
    throw new Error(`Photon search returned HTTP ${photonResponse.status}.`);
  }

  const photonData = (await photonResponse.json()) as {
    features?: PhotonFeature[];
  };
  if (!Array.isArray(photonData.features)) return null;

  return getPhotonFallback(photonData.features, place);
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
    const response = await fetchNominatim(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 86400 },
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
    const components = Object.fromEntries(
      Object.entries(address).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );

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
        components,
      },
    };
  } catch {
    return null;
  }
}

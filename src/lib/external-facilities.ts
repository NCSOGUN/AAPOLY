import { haversineDistance, estimateTravelMinutes, formatDuration } from "@/lib/haversine";
import { fetchNominatim } from "@/lib/nominatim";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_SEARCH_RADIUS_KM = 25;
const MAX_SEARCH_RADIUS_KM = 50;
const MAX_SEARCH_RESULTS = 50;

const SPECIALTY_ALIASES: Record<string, string> = {
  ent: "ENT",
  ear_nose_throat: "ENT",
  ear_nose_and_throat: "ENT",
  otolaryngology: "ENT",
  otorhinolaryngology: "ENT",
  otology: "Otology",
  rhinology: "Rhinology",
  laryngology: "Laryngology",
  audiology: "Audiology",
  head_and_neck_surgery: "Head and Neck Surgery",
  paediatric_ent: "Paediatric ENT",
  pediatric_ent: "Paediatric ENT",
};

export interface ExternalFacility {
  id: string;
  name: string;
  slug: null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: "Nigeria";
  latitude: number;
  longitude: number;
  phone: string | null;
  email: null;
  website: string | null;
  accredited: null;
  accreditationStatus: "unverified";
  verificationStatus: "unverified";
  source: "openstreetmap";
  sourceUrl: string;
  specialties: string[];
  services: string[];
  matchedSpecialties: string[];
  matchedServices: string[];
  matchStatus: "specialty_match" | "specialty_unverified";
  distanceKm: number;
  travelEstimate: {
    driving: string;
    walking: string;
    motorcycle: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeSpecialty(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseSpecialties(tags: Record<string, unknown>) {
  const raw = getString(
    tags,
    "healthcare:speciality",
    "healthcare:specialty",
    "medical_specialty",
    "speciality",
    "specialty"
  );
  if (!raw) return [];

  return [
    ...new Set(
      raw
        .split(/[;,]/)
        .map((item) => SPECIALTY_ALIASES[normalizeSpecialty(item)])
        .filter((item): item is string => item !== undefined)
    ),
  ];
}

function toCoordinate(value: unknown, min: number, max: number) {
  const coordinate = typeof value === "string" ? Number(value) : value;
  return typeof coordinate === "number" &&
    Number.isFinite(coordinate) &&
    coordinate >= min &&
    coordinate <= max
    ? coordinate
    : null;
}

function buildAddress(address: Record<string, unknown>) {
  const parts = [
    [
      getString(address, "house_number"),
      getString(address, "road", "pedestrian"),
    ]
      .filter(Boolean)
      .join(" "),
    getString(address, "suburb", "neighbourhood", "city", "town", "village"),
    getString(address, "state"),
    "Nigeria",
  ].filter(Boolean);

  return parts.length > 1 ? parts.join(", ") : null;
}

export async function searchExternalFacilities(
  latitude: number,
  longitude: number,
  requestedSpecialties: string[],
  radiusKm = DEFAULT_SEARCH_RADIUS_KM
): Promise<ExternalFacility[]> {
  if (
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0 ||
    radiusKm > MAX_SEARCH_RADIUS_KM
  ) {
    throw new Error(`External facility search radius must be between 0 and ${MAX_SEARCH_RADIUS_KM} km.`);
  }

  const latitudeDelta = radiusKm / 111.32;
  const longitudeDelta =
    radiusKm / (111.32 * Math.cos((latitude * Math.PI) / 180));
  const params = new URLSearchParams({
    amenity: "hospital",
    format: "jsonv2",
    limit: String(MAX_SEARCH_RESULTS),
    countrycodes: "ng",
    viewbox: [
      longitude - longitudeDelta,
      latitude + latitudeDelta,
      longitude + longitudeDelta,
      latitude - latitudeDelta,
    ].join(","),
    bounded: "1",
    addressdetails: "1",
    extratags: "1",
  });
  const response = await fetchNominatim(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ENT-Care-Location-Service/1.0",
    },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap facility search returned HTTP ${response.status}.`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("OpenStreetMap returned an invalid facility response.");
  }

  const requested = new Set(requestedSpecialties);
  return data.flatMap((entry): ExternalFacility[] => {
    if (!isRecord(entry)) return [];
    const osmType =
      typeof entry.osm_type === "string" ? entry.osm_type.toLowerCase() : "";
    if (
      !["node", "way", "relation"].includes(osmType) ||
      typeof entry.osm_id !== "number"
    ) {
      return [];
    }

    const name =
      typeof entry.name === "string" && entry.name.trim()
        ? entry.name.trim()
        : typeof entry.display_name === "string"
          ? entry.display_name.split(",")[0].trim()
          : "";
    const elementLatitude = toCoordinate(entry.lat, -90, 90);
    const elementLongitude = toCoordinate(entry.lon, -180, 180);
    if (!name || elementLatitude === null || elementLongitude === null) return [];

    const tags = isRecord(entry.extratags) ? entry.extratags : {};
    const address = isRecord(entry.address) ? entry.address : {};
    const specialties = parseSpecialties(tags);
    const matchedSpecialties = specialties.filter((specialty) =>
      requested.has(specialty)
    );
    const distanceKm = haversineDistance(
      latitude,
      longitude,
      elementLatitude,
      elementLongitude
    );
    if (distanceKm > radiusKm) return [];

    return [
      {
        id: `osm:${osmType}:${entry.osm_id}`,
        name,
        slug: null,
        address: buildAddress(address),
        city: getString(address, "city", "town", "village", "suburb"),
        state: getString(address, "state"),
        country: "Nigeria",
        latitude: elementLatitude,
        longitude: elementLongitude,
        phone: getString(tags, "phone", "contact:phone"),
        email: null,
        website: getString(tags, "website", "contact:website"),
        accredited: null,
        accreditationStatus: "unverified",
        verificationStatus: "unverified",
        source: "openstreetmap",
        sourceUrl: `https://www.openstreetmap.org/${osmType}/${entry.osm_id}`,
        specialties,
        services: [],
        matchedSpecialties,
        matchedServices: [],
        matchStatus: matchedSpecialties.length
          ? "specialty_match"
          : "specialty_unverified",
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        travelEstimate: {
          driving: formatDuration(estimateTravelMinutes(distanceKm, 50)),
          walking: formatDuration(estimateTravelMinutes(distanceKm, 5)),
          motorcycle: formatDuration(estimateTravelMinutes(distanceKm, 75)),
        },
      },
    ];
  });
}

export const EXTERNAL_FACILITY_SEARCH_RADIUS_KM =
  DEFAULT_SEARCH_RADIUS_KM;
export const MAX_EXTERNAL_FACILITY_SEARCH_RADIUS_KM = MAX_SEARCH_RADIUS_KM;

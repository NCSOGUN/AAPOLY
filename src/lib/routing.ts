import {
  haversineDistance,
  estimateTravelMinutes,
  formatDuration,
} from "./haversine";

const OSRM_BASE = "https://router.project-osrm.org/route/v1";

export interface TravelTimes {
  driving: string;
  walking: string;
  motorcycle: string;
}

/**
 * Fetch real travel time from OSRM for a given profile (driving/walking).
 * Returns duration in seconds, or null on failure.
 */
async function osrmDuration(
  profile: "driving" | "walking",
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<number | null> {
  try {
    const url = `${OSRM_BASE}/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    return data.routes[0].duration as number; // seconds
  } catch {
    return null;
  }
}

/**
 * Get driving, walking and motorcycle travel time estimates between two points.
 * Falls back to Haversine-based estimates when OSRM is unavailable.
 */
export async function getTravelTimes(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<TravelTimes> {
  const [drivingSecs, walkingSecs] = await Promise.all([
    osrmDuration("driving", fromLat, fromLng, toLat, toLng),
    osrmDuration("walking", fromLat, fromLng, toLat, toLng),
  ]);

  const distanceKm = haversineDistance(fromLat, fromLng, toLat, toLng);

  // Driving
  const drivingMin =
    drivingSecs !== null
      ? drivingSecs / 60
      : estimateTravelMinutes(distanceKm, 50);

  // Walking
  const walkingMin =
    walkingSecs !== null
      ? walkingSecs / 60
      : estimateTravelMinutes(distanceKm, 5);

  // Motorcycle ≈ 1.5× driving speed → driving time / 1.5
  const motorcycleMin = drivingMin / 1.5;

  return {
    driving: formatDuration(drivingMin),
    walking: formatDuration(walkingMin),
    motorcycle: formatDuration(motorcycleMin),
  };
}

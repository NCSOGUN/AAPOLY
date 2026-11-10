const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula.
 * @returns distance in kilometres
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Estimate travel time in minutes from distance, assuming average speed in km/h.
 */
export function estimateTravelMinutes(distanceKm: number, speedKmh: number): number {
  return (distanceKm / speedKmh) * 60;
}

/**
 * Format minutes into a human-readable string like "12 min" or "1h 30m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

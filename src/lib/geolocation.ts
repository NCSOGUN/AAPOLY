export type UserCoordinates = {
  latitude: number;
  longitude: number;
};

export function getUserLocation(): Promise<UserCoordinates> {
  if (!navigator.geolocation) {
    const message = window.isSecureContext
      ? "Location is not available in this browser. Enter a town or city instead."
      : "Location sharing requires a secure connection. Open this page over HTTPS or use localhost.";
    return Promise.reject(new Error(message));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
      (error) => {
        const messages: Record<number, string> = {
          1: "Location permission is blocked for this site. Allow location access in your browser’s site settings, then try again.",
          2: "Your device could not determine your location. Turn on device location services, check your connection, and try again.",
          3: "Finding your location took too long. Check that device location services are on, then try again.",
        };
        reject(new Error(messages[error.code] ?? "Your location could not be determined. Try again or enter a town or city."));
      },
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 300_000 },
    );
  });
}

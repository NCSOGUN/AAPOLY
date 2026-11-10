const MIN_REQUEST_INTERVAL_MS = 1100;

let lastRequestStartedAt = 0;
let requestQueue: Promise<void> = Promise.resolve();

export function fetchNominatim(
  url: string,
  init?: Parameters<typeof fetch>[1]
): Promise<Response> {
  const request = requestQueue.then(async () => {
    const waitMs =
      lastRequestStartedAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    lastRequestStartedAt = Date.now();
    return fetch(url, init);
  });

  requestQueue = request.then(
    () => undefined,
    () => undefined
  );
  return request;
}

// Nominatim reverse geocoding — CacheFirst, 1 req/s throttle, coords rounded to 3 dp (~111 m)
const CACHE = new Map<string, string>();
let lastRequestTs = 0;

export function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function cacheKey(lat: number, lng: number): string {
  return `${String(roundCoord(lat))},${String(roundCoord(lng))}`;
}

async function waitForThrottle(): Promise<void> {
  const elapsed = Date.now() - lastRequestTs;
  if (elapsed < 1000) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastRequestTs = Date.now();
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = cacheKey(lat, lng);
  const cached = CACHE.get(key);
  if (cached !== undefined) return cached;

  await waitForThrottle();

  let res: Response;
  try {
    res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${String(lat)}&lon=${String(lng)}&format=json`,
      { headers: { 'User-Agent': 'PrijaviMesto/1.0 (civic-issue-reporter; contact@example.com)' } },
    );
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = (await res.json()) as { display_name?: string };
  const address = data.display_name ?? null;
  if (address !== null) CACHE.set(key, address);
  return address;
}

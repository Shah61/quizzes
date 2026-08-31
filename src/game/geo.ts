/**
 * Maths for the map round.
 *
 * Pure functions over numbers, so the scoring can be checked outside a browser
 * the same way the Mimic scorer is.
 */

export interface LatLng { lat: number; lng: number }

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  // Longitude wraps: London to Alaska is not most of the way round the planet.
  let dLng = b.lng - a.lng;
  if (dLng > 180) dLng -= 360;
  if (dLng < -180) dLng += 360;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(dLng) / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Points for a guess, decaying with distance.
 *
 * Exponential rather than linear because the interesting part is the near
 * miss: landing in the right country should feel very different from landing
 * on the right continent, while everything past a few thousand kilometres is
 * equally wrong and does not need to be finely graded.
 *
 * At the default 100: same spot 100, 250km 87, 1000km 57, 2500km 25, 5000km 6.
 */
export const DECAY_KM = 1800;

export function scoreGuess(guess: LatLng, target: LatLng, max: number): number {
  const km = distanceKm(guess, target);
  return Math.round(max * Math.exp(-km / DECAY_KM));
}

/* ------------------------------------------------------- equirectangular */

/**
 * The plainest projection there is: longitude and latitude map straight onto x
 * and y. It distorts badly near the poles, but it is trivially invertible,
 * which is what a click-to-guess map needs.
 */
export const project = (p: LatLng, w: number, h: number) => ({
  x: ((p.lng + 180) / 360) * w,
  y: ((90 - p.lat) / 180) * h,
});

export const unproject = (x: number, y: number, w: number, h: number): LatLng => ({
  lat: 90 - (y / h) * 180,
  lng: (x / w) * 360 - 180,
});

/** How close is close? Used for the wording under a result. */
export function describeDistance(km: number): string {
  if (km < 25) return 'Bang on';
  if (km < 150) return 'Very close';
  if (km < 500) return 'Close';
  if (km < 1500) return 'Right area';
  if (km < 4000) return 'Wrong country, right continent — roughly';
  return 'Nowhere near';
}

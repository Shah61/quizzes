/**
 * Google Maps key handling for the Street View round.
 *
 * The round uses the **Maps Embed API**, which is the one Google still serves
 * free with no usage limit — the Street View Static and JavaScript APIs are
 * both billed per request, so an embedded iframe is the only version of this
 * that does not meter you. It is the same route WorldGuessr takes.
 *
 * A key is still required, and it is a public one by nature: it goes in an
 * iframe URL, so anybody can read it. That is expected — Google's answer is to
 * restrict the key to your own domain by HTTP referrer in the Cloud console
 * rather than to keep it secret. Do that before deploying.
 */

/** Inlined at build time by Next, so this is a constant in the browser. */
export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';

export const hasStreetView = () => MAPS_KEY.length > 0;

export interface PanoView {
  lat: number;
  lng: number;
  /** Compass direction, 0-360. Varied per question so the same place looks different. */
  heading?: number;
  pitch?: number;
  fov?: number;
}

/**
 * How far the embed may look for a panorama around the point it is given.
 *
 * This matters more than it sounds. Left unset the embed searches only a few
 * dozen metres, and the coordinates it is handed are city *centroids* — often a
 * park, a plaza or the middle of a building, with no road nearby. The result
 * was a panorama that loaded sometimes and showed a blank frame the rest of the
 * time, with no pattern to it from the player's side.
 */
const SEARCH_RADIUS_M = 1500;

export function streetViewUrl({ lat, lng, heading = 0, pitch = 0, fov = 90 }: PanoView): string {
  const params = new URLSearchParams({
    key: MAPS_KEY,
    location: `${lat},${lng}`,
    heading: String(Math.round(heading)),
    pitch: String(Math.round(pitch)),
    fov: String(Math.round(fov)),
    radius: String(SEARCH_RADIUS_M),
    // Street-level photography only. Without this the search happily returns
    // someone's photosphere of a restaurant interior, which is both unguessable
    // and nothing like the round is meant to be.
    source: 'outdoor',
  });
  return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
}

/**
 * A stable pseudo-random heading per place, so a location does not face a
 * different way each time it comes up — and so two teams see the same view.
 */
export function headingFor(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

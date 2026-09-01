/**
 * The two pictures the app puts on screen that are not questions.
 *
 * The **figure** is the cut-out character standing in the middle of every
 * screen. It is a file you supply, not something picked from the packs: those
 * are square face-crops rather than cut-outs, and at hero size a crop reads as
 * a photograph pasted over the layout. Drop a transparent PNG at
 * `public/hero/character.png` and the slot picks it up; until then the slot is
 * empty and the screens read as clean glass, which is a perfectly good look on
 * its own.
 *
 * The **face** is the small avatar in the top-right corner, greeting you by
 * name the way the reference board does. That one *is* drawn from the game's
 * own anime pack, so it is somebody different every time the menu opens
 * without a single image shipping in the repo.
 */

import characters from '@/content/packs/anime-characters.json';

type CharRow = { name: string; from: string; img: string; tier: number };

export interface Face {
  name: string;
  /** The series they are from. */
  from: string;
  img: string;
}

/**
 * The cut-out figure.
 *
 * A single path rather than one per screen, because the point is that the same
 * character fronts the whole game. Point this somewhere else, or pass a
 * different path through `<Screen>`, if you want one per screen.
 */
export const HERO_SRC = '/hero/middle.png';

/**
 * A face for the avatar. Returns null only if the pack has no usable rows,
 * in which case the greeting falls back to "player".
 *
 * `seed` makes the choice stable where a screen must not reshuffle on every
 * render; leave it out for a fresh pick.
 */
export function pickFace(seed?: number): Face | null {
  const faces = (characters as CharRow[]).filter((c) => c.tier === 1 && c.img);
  if (!faces.length) return null;
  const i = seed === undefined
    ? Math.floor(Math.random() * faces.length)
    : (seed * 7919) % faces.length;
  const { name, from, img } = faces[i];
  return { name, from, img };
}

/**
 * Everything the Mimic round can ask you to copy, behind one shape.
 *
 * The round started with synthesised recipes only. It now also plays real
 * scene audio, anime openings, and clips you cut yourself — but the countdown,
 * the one-shot rule, the scoring and the sabotage wheel do not care which of
 * those it is, so they all arrive here as a MimicRef and the round stays one
 * code path.
 *
 * The only real difference between them is where the audio comes from, which
 * is resolveRef()'s problem in mimic-audio.ts.
 */

import type { ClipMeta } from './mimic-clips';
import { SOUNDS, type SoundRecipe } from './mimic-sounds';
import scenesPack from '@/content/packs/mimic-scenes.json';
import openingsPack from '@/content/packs/anime-openings.json';

export type MimicSourceId = 'synth' | 'anime' | 'marvel' | 'movie' | 'openings' | 'custom';

export interface MimicRef {
  id: string;
  name: string;
  emoji: string;
  /** The film, series or file this came from. Shown under the name. */
  from?: string;
  source: MimicSourceId;
  /** 1 = easy to copy, 3 = awkward. */
  level: 1 | 2 | 3;
  /** Synthesised sounds carry their recipe and are rendered on the spot. */
  recipe?: SoundRecipe;
  /** Remote audio. Fetched through the app's relay, because these CDNs send no CORS header. */
  url?: string;
  /** Window into `url`, in seconds. Leave start undefined to have the best stretch picked. */
  start?: number;
  end?: number;
  /** Clips you cut yourself, stored in IndexedDB under this key. */
  clipId?: string;
}

export const MIMIC_SOURCE_INFO: Record<MimicSourceId, { label: string; emoji: string; blurb: string }> = {
  synth:    { label: 'Synth sounds',   emoji: '🎛️', blurb: 'The built-in animals, machines and melodies' },
  anime:    { label: 'Anime scenes',   emoji: '⛩️', blurb: 'Real lines from the shows' },
  marvel:   { label: 'Marvel scenes',  emoji: '🦸', blurb: 'MCU quotes and moments' },
  movie:    { label: 'Movie scenes',   emoji: '🎬', blurb: 'Lines everyone can quote' },
  openings: { label: 'Anime openings', emoji: '🎧', blurb: 'Sing the hook from a real OP or ED' },
  custom:   { label: 'My clips',       emoji: '✂️', blurb: 'Whatever you cut in the Clip Studio' },
};

export const ALL_MIMIC_SOURCES: MimicSourceId[] = ['synth', 'anime', 'marvel', 'movie', 'openings', 'custom'];

/* ------------------------------------------------------------------ synth */

const SYNTH_REFS: MimicRef[] = SOUNDS.map((s) => ({
  id: `m-${s.id}`,
  name: s.name,
  emoji: s.emoji,
  source: 'synth',
  level: s.level,
  recipe: s,
}));

/* ----------------------------------------------------------------- scenes */

type SceneRow = {
  id: string; name: string; from: string; cat: 'anime' | 'marvel' | 'movie';
  emoji: string; url: string; sec: number; start: number; end: number; tier: number;
  /** Anime lines are listed in romaji; this is what they mean. */
  en?: string;
};

const SCENE_REFS: MimicRef[] = (scenesPack as SceneRow[]).map((r) => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  // The name is the Japanese line, because that is what has to be imitated.
  // The translation belongs next to the series, as context rather than a target.
  from: r.en ? `${r.from} · ${r.en}` : r.from,
  source: r.cat,
  level: Math.min(3, Math.max(1, r.tier)) as 1 | 2 | 3,
  url: r.url,
  // Anything the round can use whole keeps its window; the long ones get the
  // best stretch picked once they are decoded, since the front of a 15-second
  // soundboard rip is often a run-up rather than the line.
  start: r.sec <= 7 ? r.start : undefined,
  end: r.sec <= 7 ? r.end : undefined,
}));

/* --------------------------------------------------------------- openings */

type OpeningRow = {
  id: string; anime: string; slug: string; type: string; song: string;
  year: number | null; audio: string; aud?: string; audBytes?: number; tier: number;
};

/**
 * The most a Mimic reference is allowed to weigh.
 *
 * These come through the relay, which is a serverless function on Vercel, and a
 * function may only return about 4.5MB. Almost every theme is around 3.6MB and
 * fits; a handful of long ones do not, and they are dropped rather than left to
 * fail at the worst possible moment — mid-round, in front of everybody.
 * Dropping them costs nothing elsewhere: the openings *round* streams the
 * original file straight from the CDN and never touches this path.
 */
const MAX_MIMIC_BYTES = 4 * 1024 * 1024;

// Only the themes with an audio-only file: the video files are up to 50MB, and
// pulling one of those to take five seconds out of it is not a fair trade.
const OPENING_REFS: MimicRef[] = (openingsPack as OpeningRow[])
  .filter((o) => typeof o.aud === 'string' && o.aud.length > 0)
  .filter((o) => !o.audBytes || o.audBytes <= MAX_MIMIC_BYTES)
  .map((o) => ({
    id: `mo-${o.id}`,
    name: o.song || `${o.anime} ${o.slug}`,
    emoji: o.type === 'OP' ? '🎧' : '🌙',
    from: `${o.anime} · ${o.slug}`,
    source: 'openings' as const,
    level: Math.min(3, Math.max(1, o.tier)) as 1 | 2 | 3,
    url: o.aud,
    // A full theme is far too long to copy, and its opening bars are usually
    // an instrumental intro — so the window is chosen from the audio itself.
    start: undefined,
    end: undefined,
  }));

/* ----------------------------------------------------------------- custom */

// Populated from IndexedDB at startup. Module-level because the setup screen,
// the arena and the clip studio all need the same view of it, and it changes
// whenever somebody saves or deletes a clip.
let customRefs: MimicRef[] = [];

export function setCustomRefs(clips: ClipMeta[]): void {
  customRefs = clips.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    from: c.from,
    source: 'custom' as const,
    level: 2 as const,
    clipId: c.id,
  }));
}

export const getCustomRefs = (): MimicRef[] => customRefs;

/* ------------------------------------------------------------------ query */

export function refsFor(sources: readonly MimicSourceId[]): MimicRef[] {
  const want = new Set(sources);
  const out: MimicRef[] = [];
  if (want.has('synth')) out.push(...SYNTH_REFS);
  for (const r of SCENE_REFS) if (want.has(r.source)) out.push(r);
  if (want.has('openings')) out.push(...OPENING_REFS);
  if (want.has('custom')) out.push(...customRefs);
  return out;
}

export function findRef(id: string): MimicRef | null {
  return refsFor(ALL_MIMIC_SOURCES).find((r) => r.id === id) ?? null;
}

/** How many references each source can supply, for the setup screen. */
export function sourceSize(source: MimicSourceId): number {
  if (source === 'synth') return SYNTH_REFS.length;
  if (source === 'openings') return OPENING_REFS.length;
  if (source === 'custom') return customRefs.length;
  return SCENE_REFS.filter((r) => r.source === source).length;
}

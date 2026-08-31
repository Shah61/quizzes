import type { Category, Question, RoundKind } from './types';

import generalQ from '@/content/questions/general.json';
import marvelQ from '@/content/questions/marvel.json';
import songsQ from '@/content/questions/songs.json';
import malaysiaQ from '@/content/questions/malaysia.json';
import animeQ from '@/content/questions/anime.json';
import minecraftQ from '@/content/questions/minecraft.json';
import terrariaQ from '@/content/questions/terraria.json';
import voicesQ from '@/content/questions/voices.json';
import countriesPack from '@/content/packs/countries.json';
import triviaCounts from '@/content/packs/trivia-counts.json';
import { headingFor } from './maps';
import { ALL_MIMIC_SOURCES, refsFor, type MimicSourceId } from './mimic-refs';

import animeChars from '@/content/packs/anime-characters.json';
import animeTitles from '@/content/packs/anime-titles.json';
import animeOpenings from '@/content/packs/anime-openings.json';
import mcPack from '@/content/packs/minecraft.json';
import trPack from '@/content/packs/terraria.json';
import myPack from '@/content/packs/malaysia-places.json';

/* ------------------------------------------------------------------ helpers */

/** A source of randomness. Pass a seeded one to get the same game twice. */
export type Rng = () => number;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * mulberry32 — small, fast, and good enough that a day's questions look
 * random. The point is only that everybody playing the same day gets the same
 * set, so the scores mean something next to each other.
 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Loose comparison so "Levi Ackerman" matches "levi ackerman" and "Lévi". */
export function normalise(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9぀-ヿ一-鿿]/g, '');
}

export function isCorrect(guess: string, q: Pick<Question, 'answer' | 'accept'>): boolean {
  const g = normalise(guess);
  if (!g) return false;
  return [q.answer, ...q.accept].some((a) => {
    const n = normalise(a);
    return n.length > 0 && (n === g || (g.length >= 4 && n.includes(g)) || (n.length >= 4 && g.includes(n)));
  });
}

/** Three wrong options drawn from the same pool, so distractors stay plausible. */
function buildChoices(answer: string, pool: readonly string[]): string[] {
  const taken = new Set([normalise(answer)]);
  const wrong: string[] = [];
  let guard = 0;
  while (wrong.length < 3 && guard++ < 400) {
    const candidate = pick(pool);
    const key = normalise(candidate);
    if (taken.has(key)) continue;
    taken.add(key);
    wrong.push(candidate);
  }
  return shuffle([answer, ...wrong]);
}

/* ------------------------------------------------------- text question banks */

type RawText = { q: string; a: string; c: string[]; h?: string; d?: number };

/**
 * The Open Trivia Database bank, keyed by topic.
 *
 * It is merged with the hand-written questions rather than replacing them: the
 * hand-written ones are the ones that know about Terraria bosses and Malaysian
 * food, and OpenTDB is what stops a 50-question round running dry.
 *
 * Loaded on demand. It is 600KB — a fifth of a megabyte gzipped — and none of
 * it is needed on the menu or while somebody is still choosing topics, so
 * importing it up front made every visitor wait for questions they had not
 * asked for yet. The counts beside it are a few hundred bytes and do load up
 * front, which is all the setup screen needs to show how deep a topic is.
 */
let TRIVIA: Partial<Record<Category, RawText[]>> = {};
let triviaReady = false;

const TRIVIA_COUNTS = triviaCounts as Partial<Record<Category, number>>;

/**
 * Pull in the question bank. Called while the setup screen is up, so it is
 * already here by the time a game starts; safe to call as often as you like.
 */
export async function preloadQuestions(): Promise<void> {
  if (triviaReady) return;
  try {
    const [trivia, places] = await Promise.all([
      import('@/content/packs/trivia.json'),
      import('@/content/packs/places.json'),
    ]);
    TRIVIA = trivia.default as Partial<Record<Category, RawText[]>>;
    PLACES = places.default as PlaceRowGeo[];
  } catch {
    // Offline or a failed chunk: the hand-written banks still make a game.
    TRIVIA = {};
    PLACES = [];
  }
  triviaReady = true;
  // The banks were built without it, so let them be built again.
  cache.text = {};
  cache.street = null;
  bankCache = null;
}

export const questionsReady = () => triviaReady;

const handWritten: Partial<Record<Category, RawText[]>> = {
  general: generalQ as RawText[],
  marvel: marvelQ as RawText[],
  songs: songsQ as RawText[],
  malaysia: malaysiaQ as RawText[],
  anime: animeQ as RawText[],
  minecraft: minecraftQ as RawText[],
  terraria: terrariaQ as RawText[],
};

const ALL_CATEGORIES: Category[] = [
  'anime', 'minecraft', 'terraria', 'marvel', 'general', 'songs', 'malaysia',
  'film', 'games', 'science', 'history', 'geography', 'sport',
];

let bankCache: Record<Category, RawText[]> | null = null;

const textBanks = (): Record<Category, RawText[]> => (bankCache ??= Object.fromEntries(
  ALL_CATEGORIES.map((c) => [c, [...(handWritten[c] ?? []), ...(TRIVIA[c] ?? [])]]),
) as Record<Category, RawText[]>);

// Country questions are generated rather than written out, so they join the
// geography pool after the banks above are assembled.
let worldCache: Question[] | null = null;
const worldPool = () => (worldCache ??= countryQuestions());

function textQuestions(category: Category): Question[] {
  return textBanks()[category].map((r, i) => ({
    id: `t-${category}-${i}`,
    category,
    prompt: r.q,
    answer: r.a,
    accept: [],
    choices: shuffle(r.c),
    hint: r.h,
    difficulty: (r.d ?? 2) as 1 | 2 | 3,
  }));
}

/* ------------------------------------------------------ media question banks */

type CharRow = { id: string; name: string; alt: string[]; from: string; img: string; tier: number };
type TitleRow = { id: string; name: string; alt: string[]; year: number | null; img: string; tier: number };
type OpRow = { id: string; anime: string; animeAlt: string[]; slug: string; type: string; song: string; year: number | null; cover: string; audio: string; aud?: string; tier: number };
type ItemRow = { id: string; name: string; kind: string; img: string; tier: number };
type PlaceRow = { id: string; name: string; state: string; img: string; tier: number };

const CHARS = animeChars as CharRow[];
const TITLES = animeTitles as TitleRow[];
const OPENINGS = animeOpenings as OpRow[];
const MC = mcPack as ItemRow[];
const TR = trPack as ItemRow[];
const MY = myPack as PlaceRow[];

function characterQuestions(): Question[] {
  const names = CHARS.map((c) => c.name);
  return CHARS.map((c) => ({
    id: `c-${c.id}`,
    category: 'anime' as const,
    prompt: 'Name this anime character',
    answer: c.name,
    accept: c.alt,
    choices: buildChoices(c.name, names),
    hint: `They appear in ${c.from}.`,
    meta: c.from,
    image: c.img,
    difficulty: Math.min(3, c.tier) as 1 | 2 | 3,
  }));
}

function animeTitleQuestions(): Question[] {
  const names = TITLES.map((t) => t.name);
  return TITLES.map((t) => ({
    id: `a-${t.id}`,
    category: 'anime' as const,
    prompt: 'Name this anime',
    answer: t.name,
    accept: t.alt,
    choices: buildChoices(t.name, names),
    hint: t.year ? `It first aired in ${t.year}.` : undefined,
    meta: t.year ? `${t.year}` : undefined,
    image: t.img,
    difficulty: Math.min(3, t.tier) as 1 | 2 | 3,
  }));
}

function openingQuestions(kind: 'OP' | 'ED'): Question[] {
  const rows = OPENINGS.filter((o) => o.type === kind);
  const names = [...new Set(rows.map((o) => o.anime))];
  return rows.map((o) => ({
    id: `o-${o.id}`,
    category: 'anime' as const,
    prompt: `Name the anime from this ${o.type === 'OP' ? 'opening' : 'ending'}`,
    answer: o.anime,
    accept: o.animeAlt ?? [],
    choices: buildChoices(o.anime, names),
    hint: o.year ? `It aired in ${o.year}.` : undefined,
    meta: `${o.anime} · ${o.slug} · "${o.song}"`,
    // The audio-only file where AnimeThemes has one. `audio` is the source
    // *video* — 32MB for Naruto OP8 against 3.5MB for the same theme's .ogg —
    // and the round only ever plays the sound, so streaming the video was
    // costing about nine times the bytes for nothing.
    //
    // The video stays on as a second source rather than being dropped: the
    // audio-only files are Ogg Vorbis, which Safari does not play, and 82 of
    // the themes have no audio-only file at all. The browser takes the first
    // source it can handle, so nobody ends up worse off than before.
    audio: o.aud ?? o.audio,
    audioFallback: o.aud ? o.audio : undefined,
    image: o.cover,
    difficulty: Math.min(3, o.tier) as 1 | 2 | 3,
  }));
}

const MC_LABEL: Record<string, string> = { item: 'Minecraft item or block', mob: 'Minecraft mob' };
const TR_LABEL: Record<string, string> = {
  weapon: 'Terraria weapon', boss: 'Terraria boss', npc: 'Terraria NPC',
  gear: 'Terraria accessory or tool', enemy: 'Terraria enemy',
};

function spriteQuestions(rows: ItemRow[], category: Category, labels: Record<string, string>): Question[] {
  return rows.map((r) => {
    // Distractors from the same kind: guessing a boss from a list of bosses.
    const sameKind = rows.filter((x) => x.kind === r.kind).map((x) => x.name);
    return {
      id: `s-${r.id}`,
      category,
      prompt: `Name this ${labels[r.kind] ?? 'item'}`,
      answer: r.name,
      accept: [],
      choices: buildChoices(r.name, sameKind.length > 8 ? sameKind : rows.map((x) => x.name)),
      hint: `It is a ${labels[r.kind] ?? 'item'}.`,
      image: r.img,
      sprite: true,
      difficulty: Math.min(3, r.tier) as 1 | 2 | 3,
    };
  });
}

function malaysiaImageQuestions(): Question[] {
  const names = MY.map((p) => p.name);
  const promptFor = (state: string) =>
    state === 'Food' ? 'Name this Malaysian dish'
      : state === 'Culture' ? 'Name this piece of Malaysian culture'
      : state === 'Nature' ? 'Name this Malaysian animal or plant'
      : 'Name this Malaysian landmark';
  return MY.map((p) => ({
    id: `m-${p.id}`,
    category: 'malaysia' as const,
    prompt: promptFor(p.state),
    answer: p.name,
    accept: [],
    choices: buildChoices(p.name, names),
    hint: ['Food', 'Culture', 'Nature'].includes(p.state) ? undefined : `You will find it in ${p.state}.`,
    meta: p.state,
    image: p.img,
    difficulty: Math.min(3, p.tier) as 1 | 2 | 3,
  }));
}

/* --------------------------------------------------------------- voices */

type RawVoice = { c: string; f: string; d: string; t: number };

/**
 * Voice Battle prompts are a performance brief rather than a question — there
 * is nothing to get "right", so the choices array stays empty and the round is
 * settled by a vote.
 */
function voiceQuestions(): Question[] {
  return (voicesQ as RawVoice[]).map((v, i) => ({
    id: `v-${i}`,
    category: (v.f === 'generic' ? 'general' : 'anime') as Category,
    prompt: `Perform ${v.c}`,
    answer: v.c,
    accept: [],
    choices: [],
    meta: v.f === 'generic' ? undefined : v.f,
    voice: { character: v.c, from: v.f, direction: v.d },
    difficulty: Math.min(3, v.t) as 1 | 2 | 3,
  }));
}

/* -------------------------------------------------------------- world */

export type CountryRow = {
  id: string; name: string; official: string; alt: string[]; capital: string;
  region: string; subregion: string; lat: number; lng: number; area: number;
  borders: string[]; cca3: string; currency: string | null; languages: string[];
  landlocked: boolean; flag: string;
};

export const COUNTRIES = countriesPack as CountryRow[];

const byCca3 = new Map(COUNTRIES.map((c) => [c.cca3, c]));

/**
 * Distractors from the same neighbourhood.
 *
 * "Which of these is the capital of Peru?" is no question at all when the other
 * three options are in Europe — the shape of the answer gives it away. Drawing
 * wrong options from the same subregion, then the same region, keeps them
 * plausible enough that you have to actually know it.
 */
function nearbyPool(country: CountryRow, key: (c: CountryRow) => string | null): string[] {
  const value = (c: CountryRow) => key(c);
  const mine = value(country);
  const pick = (list: CountryRow[]) =>
    [...new Set(list.map(value).filter((v): v is string => Boolean(v) && v !== mine))];

  const sub = pick(COUNTRIES.filter((c) => c.subregion === country.subregion));
  if (sub.length >= 3) return sub;
  const region = pick(COUNTRIES.filter((c) => c.region === country.region));
  if (region.length >= 3) return region;
  return pick(COUNTRIES);
}

/** Written questions about every country: capital, region, currency, borders, language. */
function countryQuestions(): Question[] {
  const out: Question[] = [];

  for (const c of COUNTRIES) {
    const push = (id: string, prompt: string, answer: string, pool: string[], hint?: string, difficulty: 1 | 2 | 3 = 2) => {
      if (pool.length < 3) return;
      out.push({
        id: `w-${c.id}-${id}`,
        category: 'geography',
        prompt,
        answer,
        accept: [],
        choices: buildChoices(answer, pool),
        hint,
        meta: c.name,
        difficulty,
      });
    };

    push('cap', `What is the capital of ${c.name}?`, c.capital,
      nearbyPool(c, (x) => x.capital), `It is in ${c.subregion}.`, 2);

    push('rev', `${c.capital} is the capital of which country?`, c.name,
      nearbyPool(c, (x) => x.name), `It is in ${c.subregion}.`, 2);

    push('region', `Which continent is ${c.name} in?`, c.region,
      [...new Set(COUNTRIES.map((x) => x.region))], undefined, 1);

    if (c.currency) {
      push('cur', `What is the currency of ${c.name}?`, c.currency,
        nearbyPool(c, (x) => x.currency), `It is in ${c.subregion}.`, 3);
    }

    if (c.languages.length) {
      push('lang', `Which language is official in ${c.name}?`, c.languages[0],
        nearbyPool(c, (x) => x.languages[0] ?? null), undefined, 3);
    }

    // Neighbours only where the answer is unambiguous — a country that borders
    // the answer as well would make two options right.
    if (c.borders.length) {
      const neighbour = byCca3.get(c.borders[0]);
      if (neighbour) {
        const neighbourNames = new Set(c.borders.map((b) => byCca3.get(b)?.name).filter(Boolean) as string[]);
        const pool = nearbyPool(c, (x) => x.name).filter((n) => !neighbourNames.has(n));
        push('border', `Which of these countries borders ${c.name}?`, neighbour.name, pool,
          `${c.name} has ${c.borders.length} land neighbour${c.borders.length === 1 ? '' : 's'}.`, 2);
      }
    }
  }
  return out;
}

/** Flag pictures, which run through the same image machinery as the sprites. */
function flagQuestions(): Question[] {
  const names = COUNTRIES.map((c) => c.name);
  return COUNTRIES.map((c) => ({
    id: `wf-${c.id}`,
    category: 'geography' as const,
    prompt: 'Which country flies this flag?',
    answer: c.name,
    accept: c.alt,
    choices: buildChoices(c.name, nearbyPool(c, (x) => x.name).length >= 3 ? nearbyPool(c, (x) => x.name) : names),
    hint: `It is in ${c.subregion}.`,
    meta: `${c.name} · ${c.capital}`,
    image: c.flag,
    difficulty: 2 as const,
  }));
}

/* ---------------------------------------------------------------- mimic */

/**
 * One question per reference — synthesised sound, scene clip, opening or one of
 * your own. The round resolves the audio and does the scoring; all this has to
 * carry is which reference it is.
 */
function mimicQuestions(sources: readonly MimicSourceId[]): Question[] {
  return refsFor(sources).map((r) => ({
    id: r.id,
    category: (r.source === 'synth' ? 'general' : r.source === 'marvel' ? 'marvel' : 'anime') as Category,
    prompt: `Copy this sound: ${r.name}`,
    answer: r.name,
    accept: [],
    choices: [],
    meta: r.from ?? r.name,
    mimicId: r.id,
    difficulty: r.level,
  }));
}

/** One map question per country: the place, and where it actually is. */
function geoQuestions(): Question[] {
  return COUNTRIES.map((c) => ({
    id: `g-${c.id}`,
    category: 'geography' as const,
    prompt: `Where in the world is ${c.name}?`,
    answer: c.name,
    accept: c.alt,
    choices: [],
    meta: `${c.name} · ${c.capital} · ${c.subregion}`,
    geo: { lat: c.lat, lng: c.lng, name: c.name, flag: c.flag, capital: c.capital },
    // Big and well-known first; the small states are the deep cut.
    difficulty: (c.area > 500000 ? 1 : c.area > 100000 ? 2 : 3) as 1 | 2 | 3,
  }));
}

type PlaceRowGeo = { n: string; c: string; lat: number; lng: number; p: number; v?: number };

// Loaded with the question bank rather than up front: 1,500 places is another
// 34KB gzipped, and only a game with the Street View round ever needs them.
let PLACES: PlaceRowGeo[] = [];
const countryName = new Map(COUNTRIES.map((c) => [c.id, c.name]));

/**
 * Street View questions: a spot on earth, and nothing else until you have
 * guessed. The name is deliberately kept out of the prompt — the whole round is
 * working out where you are from what you can see.
 */
function streetQuestions(): Question[] {
  return PLACES.map((p) => {
    const country = countryName.get(p.c) ?? p.c;
    return {
      id: `sv-${p.c}-${p.n}-${p.lat}`.replace(/\s+/g, '-'),
      category: 'geography' as const,
      prompt: 'Where in the world are you?',
      answer: `${p.n}, ${country}`,
      accept: [p.n, country],
      choices: [],
      meta: `${p.n}, ${country}`,
      geo: {
        lat: p.lat,
        lng: p.lng,
        name: `${p.n}, ${country}`,
        country,
        pano: true,
        heading: headingFor(`${p.n}${p.lat}`),
      },
      // A big capital is a much easier guess than a provincial town.
      difficulty: (p.p > 2000000 ? 1 : p.p > 300000 ? 2 : 3) as 1 | 2 | 3,
    };
  });
}

/* ------------------------------------------------------------------- pools */

// The openings pool gets its own slot: it is not the media pool for any one
// category, and sharing a key with `media.songs` meant whichever ran first won.
const cache: {
  text: Partial<Record<Category, Question[]>>;
  media: Partial<Record<Category, Question[]>>;
  audio: Partial<Record<'OP' | 'ED', Question[]>>;
  voice: Question[] | null;
  geo: Question[] | null;
  street: Question[] | null;
  // Keyed by the chosen sources: the pool changes with them, and clips you save
  // during a session have to be able to appear without a reload.
  mimic: Map<string, Question[]>;
} = { text: {}, media: {}, audio: {}, voice: null, geo: null, street: null, mimic: new Map() };

function mimicPool(sources: readonly MimicSourceId[]): Question[] {
  const key = [...sources].sort().join(',');
  const hit = cache.mimic.get(key);
  if (hit) return hit;
  const built = mimicQuestions(sources);
  cache.mimic.set(key, built);
  return built;
}

/** Saving or deleting a clip changes what "custom" contains. */
export function clearMimicCache(): void {
  cache.mimic.clear();
}

function textPool(category: Category): Question[] {
  if (!cache.text[category]) {
    const base = textQuestions(category);
    cache.text[category] = category === 'geography' ? [...base, ...worldPool()] : base;
  }
  return cache.text[category]!;
}

function mediaPool(category: Category): Question[] {
  if (cache.media[category]) return cache.media[category]!;
  let rows: Question[] = [];
  if (category === 'anime') rows = [...characterQuestions(), ...animeTitleQuestions()];
  else if (category === 'minecraft') rows = spriteQuestions(MC, 'minecraft', MC_LABEL);
  else if (category === 'terraria') rows = spriteQuestions(TR, 'terraria', TR_LABEL);
  else if (category === 'malaysia') rows = malaysiaImageQuestions();
  else if (category === 'geography') rows = flagQuestions();
  return (cache.media[category] = rows);
}

function audioPool(kind: 'OP' | 'ED'): Question[] {
  return (cache.audio[kind] ??= openingQuestions(kind));
}

/** How many questions each category can supply for a given round kind. */
export function availableFor(kind: RoundKind, categories: Category[], mimicSources?: MimicSourceId[]): number {
  return questionsFor(kind, categories, 999, mimicSources).length;
}

/**
 * Builds a shuffled set of questions suited to a round kind.
 * Easier questions are favoured first so a game opens accessibly.
 */
export function questionsFor(
  kind: RoundKind,
  categories: Category[],
  count: number,
  mimicSources: readonly MimicSourceId[] = ALL_MIMIC_SOURCES,
  rng: Rng = Math.random,
): Question[] {
  const cats = categories.length ? categories : ALL_CATEGORIES;
  let pool: Question[] = [];

  const animeOn = cats.includes('anime') || cats.includes('songs');

  if (kind === 'street') {
    pool = (cache.street ??= streetQuestions());
  } else if (kind === 'geo') {
    pool = (cache.geo ??= geoQuestions());
  } else if (kind === 'voice') {
    pool = (cache.voice ??= voiceQuestions());
  } else if (kind === 'mimic') {
    pool = mimicPool(mimicSources);
  } else if (kind === 'opening') {
    pool = animeOn ? audioPool('OP') : [];
  } else if (kind === 'ending') {
    pool = animeOn ? audioPool('ED') : [];
  } else if (kind === 'reveal') {
    pool = cats.flatMap((c) => mediaPool(c));
  } else if (kind === 'rapid' || kind === 'chain') {
    pool = cats.flatMap((c) => textPool(c)); // text reads fastest out loud
  } else {
    pool = cats.flatMap((c) => [...textPool(c), ...mediaPool(c)]);
    if (animeOn) pool = pool.concat(audioPool('OP'), audioPool('ED'));
  }

  if (!pool.length) return [];
  // Weight towards recognisable content, but keep some depth in the mix.
  const easy = shuffle(pool.filter((q) => q.difficulty === 1), rng);
  const mid = shuffle(pool.filter((q) => q.difficulty === 2), rng);
  const hard = shuffle(pool.filter((q) => q.difficulty === 3), rng);
  const ordered = [...easy, ...mid, ...hard];
  const target = Math.min(count, ordered.length);

  // Take proportionally from each tier rather than only the easiest ones.
  const chosen: Question[] = [];
  const seen = new Set<string>();
  const tiers = [easy, mid, hard];
  const weights = [0.45, 0.35, 0.2];
  for (let t = 0; t < tiers.length; t++) {
    const want = Math.round(target * weights[t]);
    for (const q of tiers[t]) {
      if (chosen.length >= target || chosen.filter((c) => c.difficulty === t + 1).length >= want) break;
      if (seen.has(q.id)) continue;
      seen.add(q.id); chosen.push(q);
    }
  }
  for (const q of ordered) {
    if (chosen.length >= target) break;
    if (seen.has(q.id)) continue;
    seen.add(q.id); chosen.push(q);
  }
  return shuffle(chosen, rng).slice(0, target);
}

export const CONTENT_STATS = {
  // Counted from the manifest so the menu can show a total without the pack.
  text: Object.values(handWritten).reduce((n, b) => n + b.length, 0)
    + Object.values(TRIVIA_COUNTS).reduce((n: number, v) => n + (v ?? 0), 0),
  characters: CHARS.length,
  animeTitles: TITLES.length,
  openings: OPENINGS.length,
  minecraft: MC.length,
  terraria: TR.length,
  malaysia: MY.length,
};

/** Rough count of playable items per category, for the setup screen. */
export function categorySize(c: Category): number {
  // The written count comes from the manifest rather than the pool, so the
  // number is right on the setup screen whether or not the bank has landed.
  const written = (handWritten[c]?.length ?? 0) + (TRIVIA_COUNTS[c] ?? 0)
    + (c === 'geography' ? worldPool().length : 0);
  return written + mediaPool(c).length + (c === 'anime' || c === 'songs' ? OPENINGS.length : 0);
}

/** How many tracks exist for the opening / ending rounds, for the setup screen. */
export const AUDIO_COUNTS = {
  OP: OPENINGS.filter((o) => o.type === 'OP').length,
  ED: OPENINGS.filter((o) => o.type === 'ED').length,
};

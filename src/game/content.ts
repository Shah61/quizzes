import type { Category, Question, RoundKind } from './types';

import generalQ from '@/content/questions/general.json';
import marvelQ from '@/content/questions/marvel.json';
import songsQ from '@/content/questions/songs.json';
import malaysiaQ from '@/content/questions/malaysia.json';
import animeQ from '@/content/questions/anime.json';
import minecraftQ from '@/content/questions/minecraft.json';
import terrariaQ from '@/content/questions/terraria.json';
import voicesQ from '@/content/questions/voices.json';
import { ALL_MIMIC_SOURCES, refsFor, type MimicSourceId } from './mimic-refs';

import animeChars from '@/content/packs/anime-characters.json';
import animeTitles from '@/content/packs/anime-titles.json';
import animeOpenings from '@/content/packs/anime-openings.json';
import mcPack from '@/content/packs/minecraft.json';
import trPack from '@/content/packs/terraria.json';
import myPack from '@/content/packs/malaysia-places.json';

/* ------------------------------------------------------------------ helpers */

export function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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

const TEXT_BANKS: Record<Category, RawText[]> = {
  general: generalQ as RawText[],
  marvel: marvelQ as RawText[],
  songs: songsQ as RawText[],
  malaysia: malaysiaQ as RawText[],
  anime: animeQ as RawText[],
  minecraft: minecraftQ as RawText[],
  terraria: terrariaQ as RawText[],
};

function textQuestions(category: Category): Question[] {
  return TEXT_BANKS[category].map((r, i) => ({
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
type OpRow = { id: string; anime: string; animeAlt: string[]; slug: string; type: string; song: string; year: number | null; cover: string; audio: string; tier: number };
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
    audio: o.audio,
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

/* ------------------------------------------------------------------- pools */

// The openings pool gets its own slot: it is not the media pool for any one
// category, and sharing a key with `media.songs` meant whichever ran first won.
const cache: {
  text: Partial<Record<Category, Question[]>>;
  media: Partial<Record<Category, Question[]>>;
  audio: Partial<Record<'OP' | 'ED', Question[]>>;
  voice: Question[] | null;
  // Keyed by the chosen sources: the pool changes with them, and clips you save
  // during a session have to be able to appear without a reload.
  mimic: Map<string, Question[]>;
} = { text: {}, media: {}, audio: {}, voice: null, mimic: new Map() };

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
  return (cache.text[category] ??= textQuestions(category));
}

function mediaPool(category: Category): Question[] {
  if (cache.media[category]) return cache.media[category]!;
  let rows: Question[] = [];
  if (category === 'anime') rows = [...characterQuestions(), ...animeTitleQuestions()];
  else if (category === 'minecraft') rows = spriteQuestions(MC, 'minecraft', MC_LABEL);
  else if (category === 'terraria') rows = spriteQuestions(TR, 'terraria', TR_LABEL);
  else if (category === 'malaysia') rows = malaysiaImageQuestions();
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
): Question[] {
  const cats = categories.length ? categories : (Object.keys(TEXT_BANKS) as Category[]);
  let pool: Question[] = [];

  const animeOn = cats.includes('anime') || cats.includes('songs');

  if (kind === 'voice') {
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
  const easy = shuffle(pool.filter((q) => q.difficulty === 1));
  const mid = shuffle(pool.filter((q) => q.difficulty === 2));
  const hard = shuffle(pool.filter((q) => q.difficulty === 3));
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
  return shuffle(chosen).slice(0, target);
}

export const CONTENT_STATS = {
  text: Object.values(TEXT_BANKS).reduce((n, b) => n + b.length, 0),
  characters: CHARS.length,
  animeTitles: TITLES.length,
  openings: OPENINGS.length,
  minecraft: MC.length,
  terraria: TR.length,
  malaysia: MY.length,
};

/** Rough count of playable items per category, for the setup screen. */
export function categorySize(c: Category): number {
  return textPool(c).length + mediaPool(c).length + (c === 'anime' || c === 'songs' ? OPENINGS.length : 0);
}

/** How many tracks exist for the opening / ending rounds, for the setup screen. */
export const AUDIO_COUNTS = {
  OP: OPENINGS.filter((o) => o.type === 'OP').length,
  ED: OPENINGS.filter((o) => o.type === 'ED').length,
};

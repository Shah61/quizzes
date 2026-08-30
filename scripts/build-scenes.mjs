#!/usr/bin/env node
// Builds the Mimic scene pack: real anime / Marvel / movie scene audio.
//
// Source: myinstants.com's public JSON API. The names and sources come from the
// hand-written list in sources-scenes.mjs; the API is only used to *find* a
// clip for each one, because soundboard titles are unusable on screen.
//
// Output: src/content/packs/mimic-scenes.json — URLs only. As with the rest of
// the content build, nothing is copied into this repo; the audio streams from
// the source at play time.
//
//   node scripts/build-scenes.mjs            # all groups
//   node scripts/build-scenes.mjs anime      # just one

import { writeFile, mkdir } from 'node:fs/promises';
import { SCENE_GROUPS } from './sources-scenes.mjs';
import { mp3Duration } from './mp3-duration.mjs';
import { pool, sleep } from './lib-fetch.mjs';

const OUT = new URL('../src/content/packs/', import.meta.url);
const API = 'https://www.myinstants.com/api/v1/instants/';
const UA = 'QuizArenaContentBuilder/1.0 (personal party-quiz project)';
const only = process.argv[2];

/** Mimic wants something a throat can chase — long enough to have a shape, short enough to remember. */
const IDEAL_MIN = 1.1;
const IDEAL_MAX = 6.5;
const HARD_MAX = 22;

// Soundboards are full of remixes, hour-long loops and ringtone edits of the
// same line. None of them are the scene, so they lose on sight.
const JUNK = /\b(remix|remastered|rmx|loop(ed)?|1\s*hour|10\s*hours?|extended|ringtone|bass\s*boost(ed)?|nightcore|earrape|slow(ed)?|reverb|8d|instrumental|full\s*song|cover|parody|meme\s*remix|tiktok|trap|phonk|drill|edit)\b/i;

// Anime entries have to be the Japanese track. An abridged series or a fandub
// is someone else's voice acting entirely, so these are a hard reject rather
// than a scoring penalty — a dub that scores well is worse than no clip.
const NOT_JAPANESE = /\b(dub|dubb?ed|dublado|abridged|fandub|english|eng|ingl[eé]s|latino|espa[nñ]ol|castellano|portugu[eê]s|deutsch|german|fran[cç]ais|french|italiano|russian|hindi|tagalog|arabic)\b/i;

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
// Japanese particles carry no identifying weight and are everywhere in romaji.
// Left in, "mizu no kokyuu" matched a Naruto water-clone clip on "mizu" + "no".
const STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'is', 'i', 'am', 'my', 'me', 'you', 'we', 'it', 'in', 'on', 'and',
  'no', 'wa', 'ga', 'wo', 'ni', 'ha', 'de', 'mo', 'na', 'ya', 'ka', 'ne', 'yo', 'sa',
]);
const words = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w));

/** The filename, which is where a dub usually announces itself. */
const basename = (url) => String(url).split('/').pop().replace(/\.[^.]+$/, '');

// Long but says nothing about *which* clip this is — every second upload is
// tagged "anime" or "sound". Treating these as the identifying word threw away
// good matches ("nyaa anime" started demanding the word "anime").
const GENERIC = new Set(['anime', 'sound', 'sounds', 'scene', 'voice', 'effect', 'effects', 'audio', 'clip', 'meme', 'short', 'original', 'movie', 'video']);
const isDistinctive = (w) => w.length >= 5 && !GENERIC.has(w);

/**
 * What fraction of the words we asked for actually appear in the candidate.
 *
 * Scored on the substantial words where there are enough of them: a two-letter
 * fragment matching is not evidence of anything, and letting it count is how a
 * half-match sneaks past the gate.
 */
function coverage(query, candidate) {
  const all = words(query);
  if (!all.length) return 0;
  const solid = all.filter((w) => w.length >= 3);
  const want = solid.length >= 2 ? solid : all;
  const got = new Set(words(candidate));
  const hit = want.filter((w) => got.has(w));

  // Half the words is not enough on its own when the half that matched is the
  // common one: "mizu no kokyuu" (Water Breathing) matched a Naruto water-clone
  // clip on "mizu" alone. Where the phrase contains a long, distinctive word,
  // that is the word that has to be there.
  const distinctive = want.filter(isDistinctive);
  if (distinctive.length && !hit.some(isDistinctive)) return 0;

  return hit.length / want.length;
}

/**
 * How well a soundboard entry matches the scene we are looking for.
 * Mostly word overlap with the query, minus the junk markers above.
 */
function nameScore(query, candidate) {
  const want = words(query);
  const got = new Set(words(candidate));
  if (!want.length) return 0;
  const hits = want.filter((w) => got.has(w)).length;
  let score = hits / want.length;
  // A candidate that is *only* the line scores better than one buried in extras.
  const extra = Math.max(0, [...got].length - hits);
  score -= Math.min(0.3, extra * 0.045);
  if (JUNK.test(candidate)) score -= 0.6;
  return score;
}

// Searching for a shouted line and getting the show's theme tune back is a
// common miss ("goku kamehameha" -> a Dragon Ball remix track). Entries that
// really are music opt out with `music: true`.
const IS_MUSIC = /\b(song|music|ost|soundtrack|theme|lyrics|opening|ending|full\s*version)\b/i;

/** Duration is worth points on its own: 2-4s is the sweet spot for one shot. */
function lengthScore(sec) {
  if (!sec || sec > HARD_MAX) return -1;
  if (sec < 0.7) return -0.5;
  if (sec < IDEAL_MIN) return 0.15;
  if (sec <= 4) return 1;
  if (sec <= IDEAL_MAX) return 0.75;
  // Past the window the round can use, the front of the clip has to carry the
  // whole line on its own — which it often does not. Heavily discouraged.
  if (sec <= 10) return -0.15;
  return -0.4;
}

async function searchOnce(query) {
  const url = `${API}?name=${encodeURIComponent(query)}&limit=12`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.results) ? json.results : [];
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  return [];
}

/**
 * The API ANDs every word against the title, so "tanjiro water breathing"
 * matches nothing while "tanjiro" matches plenty. Shorten the query until it
 * bites; candidates are still ranked against the full phrase afterwards, so a
 * loose search does not mean a loose result.
 */
async function search(query) {
  const terms = words(query);
  const tries = [query];
  for (let n = terms.length - 1; n >= 1; n--) tries.push(terms.slice(0, n).join(' '));
  // Last resort: the longest word, which is usually the character or the film.
  const longest = terms.slice().sort((a, b) => b.length - a.length)[0];
  if (longest && !tries.includes(longest)) tries.push(longest);

  const seen = new Set();
  const out = [];
  for (const t of tries) {
    if (!t || seen.has(t)) continue;
    seen.add(t);
    const hits = await searchOnce(t);
    for (const h of hits) if (!out.some((o) => o.sound === h.sound)) out.push(h);
    // Enough to rank properly; no need to walk the whole ladder every time.
    if (out.length >= 10) break;
    await sleep(150);
  }
  return out;
}

/** One ranged request: enough of the head to read the frame header, plus the total size. */
async function probe(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Range: 'bytes=0-16383' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const head = new Uint8Array(await res.arrayBuffer());

    let total = 0;
    const range = res.headers.get('content-range'); // "bytes 0-16383/334377"
    if (range) total = Number(range.split('/')[1]) || 0;
    else total = Number(res.headers.get('content-length')) || 0;

    const info = mp3Duration(head, total);
    if (!info) return null;
    return { ...info, bytes: total };
  } catch {
    return null;
  }
}

async function buildGroup(group) {
  console.log(`[${group.cat}] ${group.scenes.length} scenes`);
  const rows = [];
  const usedUrls = new Set();

  await pool(group.scenes, 4, async (scene) => {
    const query = scene.q ?? scene.name;
    const hits = await search(query);
    if (!hits.length) { console.log(`   ✗ ${scene.name} — nothing found`); return; }

    // Rank on the name first, then only pay for the audio of the best few.
    //
    // The coverage gate is what stops the shortened fallback queries handing
    // back something unrelated: dropping words until the API bites once matched
    // "power" against a Star Wars clip and "elric" against Futurama. A
    // candidate now has to carry at least half the words of the *original*
    // phrase, however loose the search that surfaced it.
    const ranked = hits
      .filter((h) => typeof h.sound === 'string' && /\.mp3(\?|$)/i.test(h.sound))
      .filter((h) => {
        // The sound's own filename is included deliberately: the giveaway is
        // often only there ("i-present-to-you-all-abridged-jotaro.mp3" has a
        // perfectly innocent display name).
        const title = `${h.name} ${h.slug ?? ''} ${basename(h.sound)}`;
        if (group.cat === 'anime' && NOT_JAPANESE.test(title)) return false;
        if (!scene.music && IS_MUSIC.test(title)) return false;
        return coverage(query, title) >= 0.5;
      })
      .map((h) => ({ hit: h, name: nameScore(query, `${h.name} ${h.slug ?? ''}`) }))
      .sort((a, b) => b.name - a.name)
      .slice(0, 6);

    let best = null;
    for (const cand of ranked) {
      if (usedUrls.has(cand.hit.sound)) continue;
      const info = await probe(cand.hit.sound);
      if (!info) continue;
      const total = cand.name + lengthScore(info.seconds);
      if (!best || total > best.total) best = { total, info, hit: cand.hit };
      // A strong name on a well-sized clip is as good as it gets; stop paying.
      if (cand.name >= 0.85 && info.seconds >= IDEAL_MIN && info.seconds <= 4.5) break;
    }

    if (!best || best.total <= 0.15) { console.log(`   ✗ ${scene.name} — no usable clip`); return; }

    usedUrls.add(best.hit.sound);

    const seconds = Math.round(best.info.seconds * 100) / 100;
    rows.push({
      id: `sc-${group.cat}-${norm(scene.name).replace(/ /g, '-').slice(0, 40)}`,
      name: scene.name,
      // The English meaning rides along so the round can show what the line is,
      // without putting the translation where the thing to imitate should be.
      en: scene.en,
      from: scene.from,
      cat: group.cat,
      emoji: scene.emoji,
      url: best.hit.sound,
      sec: seconds,
      // Where the round takes its 2-6s window from. Soundboard clips are
      // already trimmed to the line, so the front is almost always the line.
      start: 0,
      end: Math.min(seconds, 6),
      tier: scene.tier ?? 2,
    });
    console.log(`   ✓ ${scene.name.padEnd(42)} ${seconds.toFixed(1)}s`);
    await sleep(120);
  });

  // Keep the file order stable so diffs stay readable between rebuilds.
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return rows;
}

async function main() {
  const groups = only ? SCENE_GROUPS.filter((g) => g.cat === only) : SCENE_GROUPS;
  if (!groups.length) { console.error(`unknown group "${only}"`); process.exit(1); }

  let rows = [];
  for (const g of groups) rows = rows.concat(await buildGroup(g));

  if (only) {
    // Partial rebuild: keep the groups we did not touch.
    const { default: existing } = await import(new URL('mimic-scenes.json', OUT), { with: { type: 'json' } })
      .catch(() => ({ default: [] }));
    rows = existing.filter((r) => r.cat !== only).concat(rows);
  }

  await mkdir(OUT, { recursive: true });
  await writeFile(new URL('mimic-scenes.json', OUT), JSON.stringify(rows, null, 0));

  const byCat = {};
  for (const r of rows) byCat[r.cat] = (byCat[r.cat] ?? 0) + 1;
  console.log(`\n-> mimic-scenes.json  (${rows.length} clips)`, byCat);
}

main();

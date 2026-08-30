#!/usr/bin/env node
// Post-processes the raw packs: removes duplicate art, restores popularity order,
// and tags each row with a difficulty tier so rounds can be pitched sensibly.
import { readFile, writeFile } from 'node:fs/promises';

const DIR = new URL('../src/content/packs/', import.meta.url);
const read = async (n) => JSON.parse(await readFile(new URL(`${n}.json`, DIR), 'utf8'));
const write = async (n, r) => {
  await writeFile(new URL(`${n}.json`, DIR), JSON.stringify(r, null, 0));
  console.log(`  ${n}: ${r.length}`);
};

// Two entries sharing one image means the wiki redirected them to the same render
// (e.g. "Giant" -> the Zombie sprite). Keep the first, drop the rest.
function dedupeByImage(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const key = r.img?.split('/').pop();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeByName(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const key = r.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Rank is the popularity index from AniList; tier 1 = everyone knows it.
const tierOf = (i, n) => (i < n * 0.25 ? 1 : i < n * 0.6 ? 2 : 3);

console.log('Cleaning packs...');

// --- anime ---------------------------------------------------------------
let chars = dedupeByName(dedupeByImage(await read('anime-characters')));
chars = chars.map((r, i) => ({ ...r, tier: tierOf(i, chars.length) }));
await write('anime-characters', chars);

let titles = dedupeByName(await read('anime-titles'));
const rankOf = new Map(titles.map((t, i) => [t.name, i]));
titles = titles.map((r, i) => ({ ...r, tier: tierOf(i, titles.length) }));
await write('anime-titles', titles);

// Openings inherit their anime's popularity so the quiz opens with songs people know.
let ops = await read('anime-openings');
ops = ops
  .filter((o) => o.audio && o.song)
  .map((o) => ({ ...o, rank: rankOf.get(o.anime) ?? 9999 }))
  .sort((a, b) => a.rank - b.rank || a.slug.localeCompare(b.slug))
  .map((o, i, arr) => {
    const { rank, artist, ...rest } = o;
    return { ...rest, ...(artist ? { artist } : {}), tier: tierOf(i, arr.length) };
  });
await write('anime-openings', ops);

// --- games / places ------------------------------------------------------
for (const name of ['minecraft', 'terraria', 'malaysia-places']) {
  let rows = dedupeByImage(await read(name));
  rows = dedupeByName(rows).map((r, i, arr) => ({ ...r, tier: tierOf(i, arr.length) }));
  await write(name, rows);
}
console.log('Done.');

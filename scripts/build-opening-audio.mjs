#!/usr/bin/env node
// Adds an audio-only URL to each row of anime-openings.json.
//
// The openings round streams the video file, which is fine for playback. The
// Mimic round has to *decode* the reference to score against it, and pulling a
// 50MB webm to take five seconds out of it is not reasonable — AnimeThemes
// also publishes a ~3.5MB .ogg of the same theme, which is.
//
// Not every theme has one. Rows that come back without an `aud` field simply
// do not appear as Mimic references; the openings round is untouched either way.

import { readFile, writeFile } from 'node:fs/promises';
import { pool, sleep } from './lib-fetch.mjs';

const PACK = new URL('../src/content/packs/anime-openings.json', import.meta.url);
const UA = 'Mozilla/5.0 (compatible; QuizArenaContentBuilder/1.0)';

/** A ranged GET: the CDN answers HEAD with 403, and we only need the status. */
async function exists(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Range: 'bytes=0-64' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok && res.status !== 206) return 0;
    await res.arrayBuffer();
    const range = res.headers.get('content-range');
    return range ? Number(range.split('/')[1]) || 1 : 1;
  } catch {
    return 0;
  }
}

/**
 * The filename swap is a guess. When it misses, ask AnimeThemes directly —
 * the video record carries the real audio link, which is not always the
 * basename with a different extension.
 */
async function audioFromApi(videoUrl) {
  const basename = videoUrl.split('/').pop();
  const url = `https://api.animethemes.moe/video?filter%5Bbasename%5D=${encodeURIComponent(basename)}&include=audio`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const link = json?.videos?.[0]?.audio?.link;
    const size = json?.videos?.[0]?.audio?.size;
    return link ? { link, size: Number(size) || 0 } : null;
  } catch {
    return null;
  }
}

const rows = JSON.parse(await readFile(PACK, 'utf8'));
console.log(`[opening-audio] probing ${rows.length} themes...`);

let found = 0;
let recovered = 0;
let done = 0;
await pool(rows, 8, async (row) => {
  const ogg = row.audio
    .replace('://v.animethemes.moe/', '://a.animethemes.moe/')
    .replace(/\.webm$/, '.ogg');
  let size = await exists(ogg);
  let link = ogg;

  // Missed on the guess — ask the API what the audio file is actually called.
  if (!size) {
    const viaApi = await audioFromApi(row.audio);
    if (viaApi && viaApi.link !== ogg) {
      const confirmed = await exists(viaApi.link);
      if (confirmed) { link = viaApi.link; size = confirmed; recovered++; }
    } else if (viaApi) {
      // Same URL we already tried; nothing more to do.
    }
  }

  if (size) { row.aud = link; row.audBytes = size; found++; }
  else { delete row.aud; delete row.audBytes; }
  if (++done % 40 === 0) console.log(`   ${done}/${rows.length} — ${found} with audio`);
  await sleep(60);
});

await writeFile(PACK, JSON.stringify(rows, null, 0));
console.log(`-> anime-openings.json  (${found}/${rows.length} themes have an audio-only file, ${recovered} found via the API)`);

#!/usr/bin/env node
// Builds the media packs the quiz plays from.
// Sources: AniList (anime + characters), AnimeThemes (opening songs),
// minecraft.wiki, terraria.wiki.gg, en.wikipedia.org (Malaysia landmarks).
// Output: src/content/packs/*.json  — image/audio URLs point at the source CDNs,
// so nothing copyrighted is copied into this repo.

import { writeFile, mkdir } from 'node:fs/promises';
import { getJSON, postJSON, pool, sleep, resolveWikiImages } from './lib-fetch.mjs';
import { MC_ITEMS, MC_MOBS } from './sources-minecraft.mjs';
import { TR_WEAPONS, TR_BOSSES, TR_NPCS, TR_GEAR, TR_ENEMIES } from './sources-terraria.mjs';
import { MY_PLACES } from './sources-malaysia.mjs';

const OUT = new URL('../src/content/packs/', import.meta.url);
const only = process.argv[2]; // optional: build just one pack

async function save(name, rows) {
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(rows, null, 0));
  console.log(`  -> ${name}.json  (${rows.length} entries)`);
  return rows;
}

const ANILIST = 'https://graphql.anilist.co';

/* ---------------------------------------------------------------- anime */

async function buildAnimeCharacters(pages = 8) {
  console.log('[anime-characters] querying AniList...');
  const rows = [];
  for (let p = 1; p <= pages; p++) {
    const data = await postJSON(ANILIST, {
      query: `query($p:Int){Page(page:$p,perPage:50){characters(sort:FAVOURITES_DESC){
        id name{full native alternative} image{large}
        media(perPage:1,sort:POPULARITY_DESC){nodes{title{romaji english}}}}}}`,
      variables: { p },
    });
    const chars = data?.data?.Page?.characters ?? [];
    if (!chars.length) break;
    for (const c of chars) {
      const media = c.media?.nodes?.[0]?.title;
      if (!media || !c.image?.large) continue;
      if (c.image.large.includes('default.jpg')) continue;
      // AniList stores many names surname-first; keep both orders as accepted answers.
      const full = c.name.full?.trim();
      if (!full) continue;
      const parts = full.split(/\s+/);
      const flipped = parts.length === 2 ? `${parts[1]} ${parts[0]}` : null;
      rows.push({
        id: `ac${c.id}`,
        name: full,
        alt: [...new Set([flipped, c.name.native, ...(c.name.alternative ?? [])].filter(Boolean))].slice(0, 6),
        from: media.english || media.romaji,
        img: c.image.large,
      });
    }
    console.log(`   page ${p}: ${rows.length} total`);
    await sleep(1400); // AniList rate limit is tight
  }
  return save('anime-characters', rows);
}

async function buildAnimeTitles(pages = 6) {
  console.log('[anime-titles] querying AniList...');
  const rows = [];
  for (let p = 1; p <= pages; p++) {
    const data = await postJSON(ANILIST, {
      query: `query($p:Int){Page(page:$p,perPage:50){media(type:ANIME,sort:POPULARITY_DESC,isAdult:false){
        id title{romaji english native} coverImage{extraLarge large} bannerImage seasonYear genres episodes format}}}`,
      variables: { p },
    });
    const media = data?.data?.Page?.media ?? [];
    if (!media.length) break;
    for (const m of media) {
      const cover = m.coverImage?.extraLarge || m.coverImage?.large;
      if (!cover || !m.title?.romaji) continue;
      rows.push({
        id: `an${m.id}`,
        name: m.title.english || m.title.romaji,
        alt: [...new Set([m.title.romaji, m.title.english, m.title.native].filter(Boolean))],
        year: m.seasonYear ?? null,
        genres: (m.genres ?? []).slice(0, 3),
        episodes: m.episodes ?? null,
        img: cover,
        banner: m.bannerImage ?? null,
      });
    }
    console.log(`   page ${p}: ${rows.length} total`);
    await sleep(1400);
  }
  return save('anime-titles', rows);
}

async function buildAnimeOpenings(titles) {
  console.log('[anime-openings] cross-referencing AnimeThemes...');
  // Look each popular anime up by name and keep its OP/ED entries that have a playable video.
  const targets = titles.slice(0, 220);
  const rows = [];
  let done = 0;

  await pool(targets, 4, async (t) => {
    const name = t.alt.find((a) => /^[\x00-\x7F]+$/.test(a)) || t.name;
    const url =
      'https://api.animethemes.moe/anime?filter[name]=' + encodeURIComponent(name) +
      '&include=animethemes.song.artists,animethemes.animethemeentries.videos&page[size]=1';
    const data = await getJSON(url);
    done++;
    if (done % 25 === 0) console.log(`   ${done}/${targets.length} looked up, ${rows.length} themes`);
    const anime = data?.anime?.[0];
    if (!anime) return;
    for (const theme of anime.animethemes ?? []) {
      if (!['OP', 'ED'].includes(theme.type)) continue;
      const entry = (theme.animethemeentries ?? []).find((e) => !e.nsfw && !e.spoiler && e.videos?.length);
      const video = entry?.videos?.[0];
      if (!video?.link || !theme.song?.title) continue;
      rows.push({
        id: `at${theme.id}`,
        anime: t.name,
        animeAlt: t.alt,
        slug: theme.slug,             // e.g. "OP1"
        type: theme.type,
        song: theme.song.title,
        artist: (theme.song.artists ?? []).map((a) => a.name).join(', ') || null,
        year: anime.year ?? t.year ?? null,
        cover: t.img,
        audio: video.link,            // webm from v.animethemes.moe (seekable)
      });
    }
    await sleep(250);
  });

  // Prefer openings, and cap per-anime so one long-running show can't dominate.
  const perAnime = new Map();
  const picked = [];
  for (const r of rows.sort((a, b) => (a.type === 'OP' ? -1 : 1))) {
    const n = perAnime.get(r.anime) ?? 0;
    if (n >= 3) continue;
    perAnime.set(r.anime, n + 1);
    picked.push(r);
  }
  return save('anime-openings', picked);
}

/* ------------------------------------------------------------ mc / terraria */

async function buildMinecraft() {
  console.log('[minecraft] resolving wiki images...');
  const API = 'https://minecraft.wiki/api.php';
  const itemMap = await resolveWikiImages(API, MC_ITEMS.map((n) => `Invicon ${n}.png`), 256);
  const mobMap = await resolveWikiImages(API, MC_MOBS.map((n) => `${n}.png`), 400);
  const rows = [];
  for (const name of MC_ITEMS) {
    const url = itemMap.get(`Invicon ${name}`);
    if (url) rows.push({ id: `mci-${slug(name)}`, name, kind: 'item', img: url, pixel: true });
  }
  for (const name of MC_MOBS) {
    const url = mobMap.get(name);
    if (url) rows.push({ id: `mcm-${slug(name)}`, name, kind: 'mob', img: url, pixel: true });
  }
  return save('minecraft', rows);
}

async function buildTerraria() {
  console.log('[terraria] resolving wiki images...');
  const API = 'https://terraria.wiki.gg/api.php';
  const groups = [
    ['weapon', TR_WEAPONS], ['boss', TR_BOSSES], ['npc', TR_NPCS],
    ['gear', TR_GEAR], ['enemy', TR_ENEMIES],
  ];
  const rows = [];
  for (const [kind, names] of groups) {
    const map = await resolveWikiImages(API, names.map((n) => `${n}.png`), 256);
    for (const name of names) {
      const url = map.get(name);
      if (url) rows.push({ id: `tr-${slug(name)}`, name, kind, img: url, pixel: true });
    }
    console.log(`   ${kind}: ${rows.length} total`);
  }
  return save('terraria', rows);
}

/* ------------------------------------------------------------------ malaysia */

async function buildMalaysia() {
  console.log('[malaysia] resolving Wikipedia lead images...');
  const rows = [];
  for (let i = 0; i < MY_PLACES.length; i += 20) {
    const batch = MY_PLACES.slice(i, i + 20);
    const url =
      'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail' +
      '&pithumbsize=900&redirects=1&titles=' + encodeURIComponent(batch.map((b) => b.page).join('|'));
    const data = await getJSON(url);
    const pages = Object.values(data?.query?.pages ?? {});
    // Follow any redirects the API normalised so we can map back to our labels.
    const redirects = new Map((data?.query?.redirects ?? []).map((r) => [r.to, r.from]));
    for (const page of pages) {
      const thumb = page.thumbnail?.source;
      if (!thumb) continue;
      const original = redirects.get(page.title) ?? page.title;
      const src = batch.find((b) => b.page === original || b.page === page.title);
      if (!src) continue;
      rows.push({ id: `my-${slug(src.name)}`, name: src.name, state: src.state, img: thumb });
    }
    await sleep(200);
  }
  return save('malaysia-places', rows);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------------------------------------------------------------------- main */

(async () => {
  console.log('Building content packs...\n');
  let titles = [];
  if (!only || only === 'anime') {
    await buildAnimeCharacters();
    titles = await buildAnimeTitles();
    await buildAnimeOpenings(titles);
  }
  if (!only || only === 'games') { await buildMinecraft(); await buildTerraria(); }
  if (!only || only === 'malaysia') await buildMalaysia();
  console.log('\nDone.');
})();

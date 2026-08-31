#!/usr/bin/env node
// Builds the location list the Street View round drops you into.
//
// Source: GeoNames cities15000 (CC BY 4.0) — every city over 15,000 people,
// which is the population floor where Street View coverage becomes reliable.
//
// Coverage is the whole problem with this round. Random coordinates land in
// ocean or empty desert, and Google has photographed nothing at all in some
// countries. So:
//
//   * places are drawn from real cities, spread across countries rather than
//     piling into whichever ones have the most,
//   * countries Google has not driven are dropped outright,
//   * and if you give the script a key it will ask Street View's metadata
//     endpoint whether each place actually has a panorama, and keep the exact
//     coordinates of the one it finds. That endpoint is free.
//
//   node scripts/build-places.mjs
//   GOOGLE_MAPS_KEY=xxx node scripts/build-places.mjs      # verified

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pool, sleep } from './lib-fetch.mjs';

const run = promisify(execFile);
const OUT = new URL('../src/content/packs/', import.meta.url);
const DUMP = 'https://download.geonames.org/export/dump/cities15000.zip';
const KEY = process.env.GOOGLE_MAPS_KEY ?? '';

/**
 * Google has essentially no Street View in these, so a place there is a blank
 * screen rather than a hard question. Better to leave the country out than to
 * make the round feel broken.
 */
const NO_COVERAGE = new Set([
  'CN', 'KP', 'AF', 'IR', 'SY', 'YE', 'TM', 'TJ', 'ER', 'SS', 'LY', 'SO', 'MM',
  'BY', 'MD', 'AZ', 'SA', 'IQ', 'CF', 'TD', 'NE', 'ML', 'BI', 'GQ', 'CG', 'CD',
  'GW', 'SL', 'LR', 'TL', 'PG', 'SB', 'VU', 'FM', 'MH', 'NR', 'TV', 'KI', 'PW',
  'CU', 'VE', 'NI', 'HT', 'SR', 'GY', 'BO', 'PY',
]);

/** No more than this from any one country, so the world does not become the US. */
const PER_COUNTRY = 14;
/**
 * Coverage tracks population loosely — a 40,000-person town in rural West
 * Africa has usually never seen a Google car, where a 100,000 one is at least
 * likely to sit on a photographed road. This is a blunt instrument and no
 * substitute for the verification pass below; it just improves the odds when
 * you have not run it.
 */
const MIN_POPULATION = 100000;

async function download() {
  const zip = join(tmpdir(), 'quizarena-cities.zip');
  const dir = join(tmpdir(), 'quizarena-cities');
  console.log('[places] downloading GeoNames cities...');
  const res = await fetch(DUMP, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`GeoNames -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await new Promise((resolve, reject) => {
    const out = createWriteStream(zip);
    out.on('error', reject).on('finish', resolve).end(buf);
  });
  await run('unzip', ['-o', zip, '-d', dir]);
  return readFile(join(dir, 'cities15000.txt'), 'utf8');
}

/** Ask Street View whether there is a panorama near here. Metadata is free. */
async function coverageAt(lat, lng, radius = 8000) {
  const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=${radius}&source=outdoor&key=${KEY}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 'OK' || !json.location) return null;
    return { lat: json.location.lat, lng: json.location.lng };
  } catch {
    return null;
  }
}

async function main() {
  const text = await download();

  const byCountry = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    // name, lat, lng, country, population
    const [name, lat, lng, country, population] = [f[1], Number(f[4]), Number(f[5]), f[8], Number(f[14])];
    if (!name || !country || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (population < MIN_POPULATION) continue;
    if (NO_COVERAGE.has(country)) continue;
    if (!byCountry.has(country)) byCountry.set(country, []);
    byCountry.get(country).push({ name, lat, lng, country, population });
  }

  // Biggest first within a country, so the cap keeps the recognisable ones.
  const picked = [];
  for (const [, cities] of byCountry) {
    cities.sort((a, b) => b.population - a.population);
    picked.push(...cities.slice(0, PER_COUNTRY));
  }
  console.log(`[places] ${picked.length} candidates across ${byCountry.size} countries`);

  let rows = picked;
  if (KEY) {
    console.log('[places] checking Street View coverage (free metadata endpoint)...');
    let done = 0;
    const checked = await pool(picked, 12, async (p) => {
      const hit = await coverageAt(p.lat, p.lng);
      if (++done % 200 === 0) console.log(`   ${done}/${picked.length}`);
      await sleep(30);
      // Keep where the panorama actually is, not where the city centre is.
      return hit ? { ...p, lat: Math.round(hit.lat * 1e5) / 1e5, lng: Math.round(hit.lng * 1e5) / 1e5 } : null;
    });
    rows = checked.filter(Boolean);
    console.log(`[places] ${rows.length} of ${picked.length} have a panorama`);
  } else {
    console.log('[places] no GOOGLE_MAPS_KEY set — shipping unverified places.');
    console.log('         Set one and re-run to drop the ones with no panorama.');
  }

  const out = rows.map((p) => ({
    n: p.name,
    c: p.country,
    lat: Math.round(p.lat * 1e5) / 1e5,
    lng: Math.round(p.lng * 1e5) / 1e5,
    p: p.population,
    ...(KEY ? { v: 1 } : {}),
  }));

  await mkdir(OUT, { recursive: true });
  await writeFile(new URL('places.json', OUT), JSON.stringify(out, null, 0));
  console.log(`\n-> places.json  (${out.length} places, ${new Set(out.map((p) => p.c)).size} countries)`);
}

main();

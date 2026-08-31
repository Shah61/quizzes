#!/usr/bin/env node
// Builds the world packs: country facts, and the outlines for the map round.
//
// Two sources, both open and both vendored into this repo as derived data
// rather than called at play time:
//
//   mledoze/countries  — names, capitals, regions, borders, currencies,
//                        languages, area and a centre point. ODbL.
//   world-atlas        — Natural Earth country outlines, public domain.
//
// Flags are hotlinked from flagcdn.com, which serves the public-domain flag
// images, so no picture files land in the repo.
//
//   node scripts/build-world.mjs

import { writeFile, mkdir } from 'node:fs/promises';

const OUT = new URL('../src/content/packs/', import.meta.url);
const COUNTRIES = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const ATLAS = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const UA = 'QuizArenaContentBuilder/1.0 (personal party-quiz project)';

const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
};

/* ------------------------------------------------------------- countries */

async function buildCountries() {
  console.log('[world] fetching country data...');
  const raw = await get(COUNTRIES);

  // UN members only. The full list includes territories and dependencies,
  // which make for arguments rather than questions at a party.
  const rows = raw
    .filter((c) => c.unMember && c.capital?.[0] && c.latlng?.length === 2)
    .map((c) => ({
      id: c.cca2,
      name: c.name.common,
      official: c.name.official,
      alt: [...new Set([c.name.official, ...(c.altSpellings ?? [])])].filter((a) => a && a !== c.name.common).slice(0, 5),
      capital: c.capital[0],
      region: c.region,
      subregion: c.subregion ?? c.region,
      lat: c.latlng[0],
      lng: c.latlng[1],
      area: c.area ?? 0,
      borders: c.borders ?? [],
      cca3: c.cca3,
      currency: Object.values(c.currencies ?? {})[0]?.name ?? null,
      languages: Object.values(c.languages ?? {}).slice(0, 3),
      landlocked: Boolean(c.landlocked),
      // flagcdn serves the public-domain flag images at a fixed width.
      flag: `https://flagcdn.com/w320/${c.cca2.toLowerCase()}.png`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  await writeFile(new URL('countries.json', OUT), JSON.stringify(rows, null, 0));
  console.log(`-> countries.json  (${rows.length} UN member states)`);
  return rows;
}

/* ----------------------------------------------------------- map outlines */

/**
 * TopoJSON stores shapes as shared, delta-encoded arcs to stay small. Decoding
 * it here rather than shipping a library keeps the runtime dependency-free —
 * the game only ever sees plain rings of [lng, lat].
 */
function decodeTopology(topology, objectName) {
  const { scale, translate } = topology.transform;

  const arcs = topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });

  // A negative index means "this arc, reversed" — and it is ~i, not -i.
  const arcFor = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);

  const ring = (indices) => {
    const out = [];
    for (const i of indices) {
      const points = arcFor(i);
      // Consecutive arcs share their join, so drop the duplicate point.
      out.push(...(out.length ? points.slice(1) : points));
    }
    return out;
  };

  return topology.objects[objectName].geometries.map((g) => ({
    id: g.id,
    name: g.properties?.name ?? '',
    polygons: g.type === 'Polygon'
      ? [g.arcs.map(ring)[0]]
      : g.arcs.map((poly) => ring(poly[0])),
  }));
}

/** Drop points that barely change the shape — the map is 900px wide, not a survey. */
function simplify(points, tolerance = 0.35) {
  if (points.length < 4) return points;
  const out = [points[0]];
  for (const p of points) {
    const last = out[out.length - 1];
    if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) >= tolerance) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push(first);
  return out.length >= 4 ? out : points;
}

async function buildOutlines() {
  console.log('[world] fetching country outlines...');
  const topo = await get(ATLAS);
  const shapes = decodeTopology(topo, 'countries');

  const rows = shapes
    .map((s) => ({
      name: s.name,
      // Round to three decimals: about 100m, far past what a world map shows.
      polygons: s.polygons
        .map((p) => simplify(p).map(([lng, lat]) => [Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000]))
        .filter((p) => p.length >= 4),
    }))
    .filter((s) => s.polygons.length);

  await writeFile(new URL('world-map.json', OUT), JSON.stringify(rows, null, 0));
  const points = rows.reduce((n, r) => n + r.polygons.reduce((m, p) => m + p.length, 0), 0);
  console.log(`-> world-map.json  (${rows.length} shapes, ${points} points)`);
}

await mkdir(OUT, { recursive: true });
await buildCountries();
await buildOutlines();

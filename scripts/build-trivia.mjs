#!/usr/bin/env node
// Pulls the written-question bank from the Open Trivia Database.
//
// The hand-written banks are good but thin — 320 questions across seven topics,
// which a couple of 50-question rounds will walk straight through. OpenTDB has
// around 5,300 human-verified multiple-choice questions and no API key, so this
// deepens every topic and adds six more.
//
// Licence: OpenTDB is CC BY-SA 4.0. The attribution is in the README, and the
// questions stay in this repo under the same terms. Unlike the audio, plain
// trivia text carries no streaming-rights problem.
//
//   node scripts/build-trivia.mjs
//
// Takes about ten minutes: their rate limit is one request per five seconds.

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { sleep } from './lib-fetch.mjs';

const OUT = new URL('../src/content/packs/', import.meta.url);
const EXISTING = new URL('../src/content/questions/', import.meta.url);
const API = 'https://opentdb.com';
const UA = 'QuizArenaContentBuilder/1.0 (personal party-quiz project)';

/**
 * Which OpenTDB categories feed which topic in the game.
 *
 * Grouped by what a player would expect to be asked about rather than by
 * OpenTDB's own splits — nobody picks "Gadgets" off a menu, but plenty of
 * people pick Science.
 */
const TOPICS = {
  general:   [9, 25, 26, 10],           // general knowledge, art, celebrities, books
  film:      [11, 14, 32],              // film, television, cartoons
  games:     [15, 16],                  // video games, board games
  science:   [17, 18, 19, 27, 28, 30],  // science, computers, maths, animals, vehicles, gadgets
  history:   [23, 20, 24],              // history, mythology, politics
  geography: [22],
  sport:     [21],
  songs:     [12, 13],                  // music, musicals
  anime:     [31],
  marvel:    [29],                      // comics
};

const DIFFICULTY = { easy: 1, medium: 2, hard: 3 };

const decode = (s) => Buffer.from(s, 'base64').toString('utf8');

/** A session token stops the same question coming back on every request. */
async function newToken() {
  const res = await fetch(`${API}/api_token.php?command=request`, { headers: { 'User-Agent': UA } });
  const json = await res.json();
  return json?.token ?? null;
}

async function fetchBatch(category, token, amount = 50) {
  const url = `${API}/api.php?amount=${amount}&category=${category}&type=multiple&encode=base64${token ? `&token=${token}` : ''}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
      if (res.status === 429) { await sleep(6000); continue; }
      if (!res.ok) { await sleep(2500); continue; }
      const json = await res.json();
      // 0 = fine, 1 = no more for this category, 4 = token exhausted here.
      if (json.response_code === 1 || json.response_code === 4) return null;
      if (json.response_code !== 0) { await sleep(2500); continue; }
      return json.results ?? [];
    } catch {
      await sleep(3000);
    }
  }
  return [];
}

/** Loose key so the same question phrased identically is only kept once. */
const keyOf = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  console.log('[trivia] requesting a session token...');
  const token = await newToken();

  // Never re-ask something the hand-written banks already cover.
  const seen = new Set();
  for (const file of ['general', 'anime', 'marvel', 'songs', 'malaysia', 'minecraft', 'terraria']) {
    try {
      const rows = JSON.parse(await readFile(new URL(`${file}.json`, EXISTING), 'utf8'));
      for (const r of rows) seen.add(keyOf(r.q));
    } catch { /* a missing bank is not a problem */ }
  }
  console.log(`[trivia] ${seen.size} hand-written questions will not be duplicated`);

  const out = {};
  for (const [topic, categories] of Object.entries(TOPICS)) {
    const rows = [];
    for (const category of categories) {
      // Keep asking this category until it stops giving anything new.
      for (let page = 0; page < 40; page++) {
        const batch = await fetchBatch(category, token);
        if (batch === null) break;              // category exhausted
        if (!batch.length) { await sleep(5200); continue; }

        for (const item of batch) {
          const q = decode(item.question).trim();
          const a = decode(item.correct_answer).trim();
          const wrong = (item.incorrect_answers ?? []).map(decode).map((x) => x.trim());
          if (!q || !a || wrong.length < 3) continue;
          const key = keyOf(q);
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push({
            q,
            a,
            c: [a, ...wrong.slice(0, 3)],
            d: DIFFICULTY[item.difficulty] ?? 2,
          });
        }
        // Their documented limit is one call every five seconds.
        await sleep(5200);
      }
      console.log(`   ${topic} <- category ${category}: ${rows.length} so far`);
    }
    out[topic] = rows;
  }

  await mkdir(OUT, { recursive: true });
  await writeFile(new URL('trivia.json', OUT), JSON.stringify(out, null, 0));

  const counts = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]));
  // A few bytes of counts, written next to the pack so the setup screen can
  // show how deep each topic is without pulling the whole 600KB of questions.
  await writeFile(new URL('trivia-counts.json', OUT), JSON.stringify(counts, null, 0));
  const total = Object.values(out).reduce((n, v) => n + v.length, 0);
  console.log(`\n-> trivia.json  (${total} questions)`, counts);
}

main();

#!/usr/bin/env node
// Builds the Japanese duel's word bank from Jisho, plus the kana charts.
import { writeFile } from 'node:fs/promises';
import { getJSON, sleep } from './lib-fetch.mjs';
import { toRomaji, hasKanji } from './romaji.mjs';

const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];
const PAGES = 22; // 20 entries per page

// Jisho splits a gloss on commas, so "dog (Canis familiaris)" can arrive as
// ["dog (Canis", "familiaris)"]. Rejoin first, strip the bracketed asides, then re-split.
function cleanGlosses(defs) {
  let joined = (defs ?? []).join(', ');
  // Parentheses nest, e.g. "dog (Canis (lupus) familiaris)". Remove innermost pairs
  // repeatedly so no orphan fragment like "familiaris)" survives.
  let prev;
  do { prev = joined; joined = joined.replace(/\([^()]*\)/g, ''); } while (joined !== prev);
  return joined
    .replace(/\s+/g, ' ')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const rows = [];
const seen = new Set();

for (const level of LEVELS) {
  let added = 0;
  for (let page = 1; page <= PAGES; page++) {
    const url =
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(`#jlpt-${level} #common`)}&page=${page}`;
    const data = await getJSON(url);
    const entries = data?.data ?? [];
    if (!entries.length) break;

    for (const e of entries) {
      const jp = e.japanese?.[0];
      if (!jp) continue;
      const word = jp.word || jp.reading;
      const reading = jp.reading || jp.word;
      if (!word || !reading) continue;
      if (seen.has(word)) continue;

      const sense = e.senses?.[0];
      if (!sense) continue;
      const meanings = cleanGlosses(sense.english_definitions)
        .filter((m) => m.length >= 2 && m.length <= 34);
      if (!meanings.length) continue;

      // Jisho tags a word with every level it appears in; the easiest one is its real level.
      const levels = (e.jlpt ?? []).map((t) => t.replace('jlpt-', ''));
      const easiest = LEVELS.slice().reverse().find((l) => levels.includes(l)) ?? level;

      seen.add(word);
      added++;
      rows.push({
        w: word,                                  // written form (kanji or kana)
        r: reading,                               // kana reading
        ro: toRomaji(reading),                    // romaji
        m: meanings.slice(0, 3),                  // english meanings
        lv: easiest,
        pos: (sense.parts_of_speech ?? [])[0] ?? null,
        kanji: hasKanji(word),
      });
    }
    await sleep(700); // be polite to Jisho
  }
  console.log(`  ${level}: +${added} (total ${rows.length})`);
}

// Kana charts, generated rather than typed out.
const HIRA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const KATA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const kana = [];
for (const set of [['hiragana', HIRA], ['katakana', KATA]]) {
  for (const ch of set[1]) kana.push({ ch, ro: toRomaji(ch), script: set[0] });
}

await writeFile(new URL('../src/content/packs/japanese-vocab.json', import.meta.url), JSON.stringify(rows, null, 0));
await writeFile(new URL('../src/content/packs/japanese-kana.json', import.meta.url), JSON.stringify(kana, null, 0));
console.log(`\nvocab: ${rows.length}  kana: ${kana.length}`);
console.log('by level:', Object.fromEntries(LEVELS.map((l) => [l, rows.filter((r) => r.lv === l).length])));

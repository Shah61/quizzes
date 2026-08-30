import vocabPack from '@/content/packs/japanese-vocab.json';
import kanaPack from '@/content/packs/japanese-kana.json';
import { shuffle, normalise } from './content';

export type JLevel = 'n5' | 'n4' | 'n3' | 'n2' | 'n1';
export type JMode = 'jp-en' | 'en-jp' | 'reading' | 'kana' | 'type';

export interface VocabRow {
  w: string;  r: string;  ro: string;
  m: string[]; lv: JLevel; pos: string | null;
  kanji: boolean; kata?: boolean;
}
export interface KanaRow { ch: string; ro: string; script: 'hiragana' | 'katakana' }

export const VOCAB = vocabPack as VocabRow[];
export const KANA = kanaPack as KanaRow[];

export const MODE_INFO: Record<JMode, { title: string; blurb: string; emoji: string }> = {
  'jp-en':   { title: 'Japanese → English', blurb: 'Read the word, pick what it means.',        emoji: '🇯🇵' },
  'en-jp':   { title: 'English → Japanese', blurb: 'Pick the Japanese for the English word.',   emoji: '🇬🇧' },
  reading:   { title: 'Reading',            blurb: 'How is this kanji actually read?',          emoji: '🔤' },
  kana:      { title: 'Kana',               blurb: 'Hiragana and katakana, one character at a time.', emoji: 'あ' },
  type:      { title: 'Type the romaji',    blurb: 'Spell the reading out. Players alternate.', emoji: '⌨️' },
};

export const LEVEL_INFO: Record<JLevel, string> = {
  n5: 'Beginner', n4: 'Elementary', n3: 'Intermediate', n2: 'Upper', n1: 'Advanced',
};

export interface JQuestion {
  id: string;
  mode: JMode;
  /** The instruction line above the prompt. */
  ask: string;
  /** The big centred prompt. */
  main: string;
  /** Optional smaller line under it. */
  sub?: string;
  answer: string;
  accept: string[];
  choices: string[];
  level: JLevel;
  /** Shown after answering. */
  reveal: string;
}

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

function distractors(answer: string, pool: string[], n = 3): string[] {
  const taken = new Set([normalise(answer)]);
  const out: string[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 500) {
    const c = pick(pool);
    const key = normalise(c);
    if (!key || taken.has(key)) continue;
    taken.add(key);
    out.push(c);
  }
  return out;
}

/** Words at the chosen levels, with a sensible fallback if a level is empty. */
export function poolFor(levels: JLevel[]): VocabRow[] {
  const rows = VOCAB.filter((v) => levels.includes(v.lv));
  return rows.length >= 20 ? rows : VOCAB;
}

export function makeQuestion(pool: VocabRow[], modes: JMode[], index: number): JQuestion {
  const mode = pick(modes.length ? modes : (['jp-en'] as JMode[]));
  const id = `jq-${index}-${Math.random().toString(36).slice(2, 7)}`;

  if (mode === 'kana') {
    const row = pick(KANA);
    return {
      id, mode, level: 'n5',
      ask: `Which ${row.script} character is this?`,
      main: row.ch,
      answer: row.ro,
      accept: [row.ro],
      choices: shuffle([row.ro, ...distractors(row.ro, KANA.map((k) => k.ro))]),
      reveal: `${row.ch} = ${row.ro}`,
    };
  }

  // Reading questions only make sense for words actually written with kanji.
  const source = mode === 'reading' ? pool.filter((v) => v.kanji && v.w !== v.r) : pool;
  const row = pick(source.length ? source : pool);
  const meaning = row.m[0];

  if (mode === 'jp-en') {
    return {
      id, mode, level: row.lv,
      ask: 'What does this mean?',
      main: row.w,
      sub: row.w === row.r ? undefined : row.r,
      answer: meaning,
      accept: row.m,
      choices: shuffle([meaning, ...distractors(meaning, pool.map((v) => v.m[0]))]),
      reveal: `${row.w}（${row.r}）· ${row.ro} · ${row.m.join(', ')}`,
    };
  }

  if (mode === 'en-jp') {
    return {
      id, mode, level: row.lv,
      ask: 'Which word is this?',
      main: meaning,
      answer: row.w,
      accept: [row.w, row.r],
      choices: shuffle([row.w, ...distractors(row.w, pool.map((v) => v.w))]),
      reveal: `${row.w}（${row.r}）· ${row.ro}`,
    };
  }

  if (mode === 'reading') {
    return {
      id, mode, level: row.lv,
      ask: 'How is this read?',
      main: row.w,
      sub: row.m.join(', '),
      answer: row.r,
      accept: [row.r, row.ro],
      // Readings of a similar length make far better distractors than random ones.
      choices: shuffle([
        row.r,
        ...distractors(row.r, pool.filter((v) => Math.abs([...v.r].length - [...row.r].length) <= 1).map((v) => v.r)),
      ]),
      reveal: `${row.w} = ${row.r} · ${row.ro}`,
    };
  }

  // type
  return {
    id, mode, level: row.lv,
    ask: 'Type the reading in romaji',
    main: row.w,
    sub: row.m.join(', '),
    answer: row.ro,
    accept: [row.ro, row.r],
    choices: [],
    reveal: `${row.w}（${row.r}）· ${row.ro}`,
  };
}

/** Typed answers are forgiving about long vowels, which learners spell either way. */
export function typedIsCorrect(input: string, q: JQuestion): boolean {
  const loosen = (s: string) =>
    normalise(s)
      .replace(/ou/g, 'o').replace(/oo/g, 'o')
      .replace(/uu/g, 'u').replace(/ei/g, 'e')
      .replace(/ii/g, 'i').replace(/aa/g, 'a');
  const given = loosen(input);
  if (!given) return false;
  return q.accept.some((a) => loosen(a) === given);
}

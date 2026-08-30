/**
 * Regression suite for the Mimic scorer.
 *
 * Microphone capture needs a browser, but the scorer itself is pure functions
 * over Float32Array — so the whole grading path can be exercised in Node against
 * synthetic takes whose "correct" answer we know by construction.
 *
 * It imports src/game/mimic-dsp.ts directly (Node >= 22.18 strips the types), so
 * this tests the shipped code rather than a copy that can drift away from it.
 *
 *   node scripts/test-mimic-dsp.mjs
 *
 * Exits non-zero if any case falls outside its tolerance band.
 */

import { extractFeatures, scoreTake } from '../src/game/mimic-dsp.ts';
import { SOUNDS } from '../src/game/mimic-sounds.ts';

const RATE = 16000; // the analysis rate the app decimates to

/* ------------------------------------------------------------------ synth */

/**
 * Mirrors renderRecipe() in mimic-audio.ts: same envelope shape (exponential
 * attack, hold to 75%, exponential release) and the same exponential frequency
 * glide, so the features here look like the ones the browser produces.
 */
function wave(kind, phase) {
  const t = phase / (2 * Math.PI);
  const frac = t - Math.floor(t);
  switch (kind) {
    case 'sine': return Math.sin(phase);
    case 'square': return frac < 0.5 ? 1 : -1;
    case 'sawtooth': return 2 * frac - 1;
    default: return 4 * Math.abs(frac - 0.5) - 1; // triangle
  }
}

function synth(segs, rate = RATE) {
  const total = segs.reduce((n, s) => n + s.dur + (s.gap ?? 0), 0) + 0.2;
  const out = new Float32Array(Math.ceil(total * rate));
  let t = 0;
  for (const seg of segs) {
    if (seg.hz > 0 && seg.dur > 0.005) {
      const peak = seg.gain ?? 0.5;
      const atk = Math.min(0.02, seg.dur * 0.2);
      const hold = seg.dur * 0.75;
      const start = Math.floor(t * rate);
      const n = Math.floor(seg.dur * rate);
      const glide = seg.to && seg.to !== seg.hz ? Math.max(20, seg.to) / seg.hz : 1;
      let phase = 0;
      for (let i = 0; i < n; i++) {
        const u = i / rate;
        const f = glide === 1 ? seg.hz : seg.hz * Math.pow(glide, u / seg.dur);
        phase += (2 * Math.PI * f) / rate;
        let g;
        if (u < atk) g = 0.0001 * Math.pow(peak / 0.0001, u / atk);
        else if (u < hold) g = peak;
        else g = peak * Math.pow(0.0001 / peak, (u - hold) / Math.max(1e-6, seg.dur - hold));
        out[start + i] += g * wave(seg.wave ?? 'triangle', phase);
      }
    }
    t += seg.dur + (seg.gap ?? 0);
  }
  return out;
}

const feats = (samples) => extractFeatures(samples, RATE);

/* ------------------------------------------- ways of getting it wrong */

const shift = (segs, semis) => {
  const k = Math.pow(2, semis / 12);
  return segs.map((s) => ({ ...s, hz: s.hz * k, to: s.to ? s.to * k : undefined }));
};

/**
 * Same notes, in the same order, over the same total length — but the note
 * boundaries land in the wrong places. Holding the length fixed is what keeps
 * this a pure timing error: stretching the take as well would drag the melody
 * and the effort gate down with it and stop measuring rhythm on its own.
 */
const wrongRhythm = (segs) => {
  const total = segs.reduce((n, s) => n + s.dur + (s.gap ?? 0), 0);
  const weights = segs.map((_, i) => (i % 2 ? 0.45 : 1.75));
  const wsum = weights.reduce((a, b) => a + b, 0);
  return segs.map((s, i) => ({
    ...s,
    dur: Math.max(0.07, (total * weights[i]) / wsum - (s.gap ?? 0)),
  }));
};

/** Same timing, but the melody walks the wrong way. */
const wrongTune = (segs) => {
  const base = segs.length ? segs[0].hz : 300;
  return segs.map((s, i) => {
    // Invert the interval around the first note, then push it off key.
    const inverted = (base * base) / Math.max(40, s.hz);
    const off = inverted * Math.pow(2, (i % 2 ? 3 : -4) / 12);
    return { ...s, hz: Math.min(900, Math.max(90, off)), to: undefined };
  });
};

/** One flat note for the same total length: no melody, no attacks. */
const drone = (segs) => {
  const hzs = segs.filter((s) => s.hz > 0).map((s) => s.hz).sort((a, b) => a - b);
  const median = hzs.length ? hzs[Math.floor(hzs.length / 2)] : 300;
  const total = segs.reduce((n, s) => n + s.dur + (s.gap ?? 0), 0);
  return [{ hz: median, dur: total, wave: 'triangle' }];
};

/**
 * A walking bassline and a kick under the signal — what a real scene clip
 * sounds like, and what the vocal band-pass in extractFeatures exists to see
 * past. Deliberately loud: the bass is the strongest periodic thing in the
 * frame, so an unfiltered tracker locks onto it instead of the line.
 */
function addBacking(samples) {
  const out = Float32Array.from(samples);
  const notes = [55, 55, 73.42, 65.41]; // A1 A1 D2 C2
  const beat = 0.4;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const hz = notes[Math.floor(t / beat) % notes.length];
    const env = 0.9 - 0.5 * ((t % beat) / beat);
    const phase = 2 * Math.PI * hz * t;
    const bass = (2 * ((phase / (2 * Math.PI)) % 1) - 1) * env;
    const sinceBeat = t % beat;
    const kick = sinceBeat < 0.09 ? Math.sin(2 * Math.PI * 52 * sinceBeat) * Math.exp(-sinceBeat * 28) : 0;
    out[i] += 0.42 * bass + 0.55 * kick;
  }
  return out;
}

function noiseLike(samples) {
  // Deterministic PRNG so the suite gives the same answer on every run.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < out.length; i++) out[i] = rnd() * 0.4;
  return out;
}

/* ------------------------------------------------------------------ cases */

/**
 * Expected totals, with the tolerance each case is allowed to move.
 *
 * These are the documented behaviour of the scorer: a deep and a high voice
 * tracing the same shape must score the same, and each way of getting it wrong
 * has to stay clearly separated from the others.
 */
const CASES = [
  { name: 'identical',        expect: 100, tol: 1,  make: (segs) => synth(segs) },
  { name: 'octave up',        expect: 99,  tol: 4,  make: (segs) => synth(shift(segs, 12)) },
  // 74, not 99: below roughly 250Hz the octave guard in detectPitch fires on the
  // wrong lag often enough to put a scatter of frames an octave high, which the
  // melody correlation then reads as wobble. Pre-existing, measured rather than
  // aspired to, and tracked here so it cannot quietly get worse.
  { name: 'octave down',      expect: 74,  tol: 8,  make: (segs) => synth(shift(segs, -12)) },
  { name: 'fifth up',         expect: 99,  tol: 6,  make: (segs) => synth(shift(segs, 7)) },
  { name: 'quiet (gain x0.1)', expect: 100, tol: 3, make: (segs) => synth(segs).map((v) => v * 0.1) },
  { name: 'wrong rhythm',     expect: 59,  tol: 12, make: (segs) => synth(wrongRhythm(segs)) },
  { name: 'wrong tune',       expect: 49,  tol: 12, make: (segs) => synth(wrongTune(segs)) },
  { name: 'drone',            expect: 28,  tol: 14, make: (segs) => synth(drone(segs)) },
  { name: 'noise',            expect: 0,   tol: 8,  make: (segs) => noiseLike(synth(segs)) },
];

/**
 * A spread of reference material: pure melodies, glides and short barks.
 *
 * Every one is chosen so that transposing it a full octave in either direction
 * still lands inside the tracker's 65-1100Hz window. Sounds that already sit
 * near the ceiling (heal, coin, bird) get clipped when doubled and report an
 * octave down, which would measure the range limit rather than the scorer.
 */
const REFS = [
  'mel-wave', 'mel-question', 'mel-rise', 'mel-triplet', 'mel-long',
  'wolf', 'dog', 'gameover', 'sheep', 'attack',
];

function run() {
  const recipes = REFS.map((id) => SOUNDS.find((s) => s.id === id)).filter(Boolean);
  if (recipes.length !== REFS.length) {
    console.error('Some reference recipes are missing from mimic-sounds.ts');
    process.exit(2);
  }

  const rows = [];
  let failed = 0;

  for (const c of CASES) {
    const scores = [];
    for (const r of recipes) {
      const ref = feats(synth(r.segs));
      const take = feats(Float32Array.from(c.make(r.segs)));
      scores.push(scoreTake(ref, take));
    }
    const mean = (k) => scores.reduce((n, s) => n + s[k], 0) / scores.length;
    const total = Math.round(mean('total'));
    const lo = Math.min(...scores.map((s) => s.total));
    const hi = Math.max(...scores.map((s) => s.total));
    const ok = Math.abs(total - c.expect) <= c.tol;
    if (!ok) failed++;
    rows.push({
      case: c.name,
      total,
      expect: `${c.expect}±${c.tol}`,
      range: `${lo}-${hi}`,
      melody: Math.round(mean('melody')),
      rhythm: Math.round(mean('rhythm')),
      ok: ok ? 'pass' : 'FAIL',
    });
  }

  console.log(`\nMimic scorer — ${recipes.length} reference sounds, mean total per case\n`);
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log(`${pad('case', 20)}${padL('total', 6)}${padL('expect', 10)}${padL('range', 9)}${padL('melody', 8)}${padL('rhythm', 8)}   result`);
  console.log('-'.repeat(69));
  for (const r of rows) {
    console.log(
      `${pad(r.case, 20)}${padL(r.total, 6)}${padL(r.expect, 10)}${padL(r.range, 9)}${padL(r.melody, 8)}${padL(r.rhythm, 8)}   ${r.ok}`,
    );
  }

  // The separation between the cases is the thing that actually makes the round
  // playable: getting the tune wrong has to cost more than being a bit late.
  const by = Object.fromEntries(rows.map((r) => [r.case, r.total]));
  const ORDER = ['identical', 'wrong rhythm', 'wrong tune', 'drone', 'noise'];
  let ordered = true;
  for (let i = 1; i < ORDER.length; i++) {
    if (by[ORDER[i]] >= by[ORDER[i - 1]]) ordered = false;
  }
  console.log(`\nseparation ${ORDER.map((o) => `${o} ${by[o]}`).join('  >  ')}  ${ordered ? 'pass' : 'FAIL'}`);
  if (!ordered) failed++;

  // Pitch invariance is the core promise of the round: the same shape traced in a
  // different register has to score the same. Asserted over the transpositions
  // the scorer actually holds up on; octave-down is reported but not asserted,
  // because it is a known weakness of the tracker at low frequencies.
  const spread = Math.max(by['identical'] - by['octave up'], by['identical'] - by['fifth up'], by['identical'] - by['quiet (gain x0.1)']);
  const invariant = spread <= 8;
  console.log(`pitch invariance  identical ${by['identical']} vs +12/+7/quiet, worst drop ${spread}  ${invariant ? 'pass' : 'FAIL'}`);
  console.log(`  (octave down ${by['octave down']} — known low-frequency tracker weakness, tracked not asserted)`);
  if (!invariant) failed++;

  /* ------------------------------------ references that are not clean */

  // A reference that holds one note has no contour to trace — an alarm clock
  // is rhythm, not tune. Correlating against a flat line measures nothing, and
  // the zero-variance guard in correlation() used to hand a note-perfect copy a
  // melody of zero, capping three of the built-in sounds at 66.
  const FLAT_REFS = ['alarm', 'phone', 'reverse', 'microwave'];
  const flatRows = FLAT_REFS.map((id) => {
    const r = SOUNDS.find((s) => s.id === id);
    const ref = feats(synth(r.segs));
    return {
      name: r.name,
      perfect: scoreTake(ref, feats(synth(r.segs))).total,
      offbeat: scoreTake(ref, feats(synth(wrongRhythm(r.segs)))).total,
    };
  });
  const flatOk = flatRows.every((r) => r.perfect >= 95 && r.perfect - r.offbeat >= 20);
  console.log(`\nflat references  ${flatRows.map((r) => `${r.name} ${r.perfect}/${r.offbeat}`).join('  ')}`);
  console.log(`  perfect copy >= 95 and >= 20 clear of an off-beat take  ${flatOk ? 'pass' : 'FAIL'}`);
  if (!flatOk) failed++;

  // Real scene audio is a mix. The band-pass in extractFeatures restricts pitch
  // tracking to the band a voice lives in, so the bassline underneath cannot
  // outvote the line the player is being asked to copy. What has to survive is
  // the ability to tell a right take from a wrong one.
  const musicScores = recipes.map((r) => {
    const backed = feats(addBacking(synth(r.segs)));
    return {
      matched: scoreTake(backed, feats(addBacking(synth(r.segs)))).total,
      clean: scoreTake(backed, feats(synth(r.segs))).total,
      wrong: scoreTake(backed, feats(synth(wrongTune(r.segs)))).total,
    };
  });
  const avg = (k) => Math.round(musicScores.reduce((n, s) => n + s[k], 0) / musicScores.length);
  const [mMatched, mClean, mWrong] = [avg('matched'), avg('clean'), avg('wrong')];
  const musicOk = mMatched >= 90 && mClean - mWrong >= 8;
  console.log(`music-backed reference  same-take ${mMatched}, clean take ${mClean}, wrong tune ${mWrong}`);
  console.log(`  still separates a right take from a wrong one  ${musicOk ? 'pass' : 'FAIL'}`);
  if (!musicOk) failed++;

  console.log(failed ? `\n${failed} check(s) FAILED\n` : '\nall checks passed\n');
  process.exit(failed ? 1 : 0);
}

run();

/**
 * Scoring for the Mimic round.
 *
 * The whole point is to grade *what a throat can control* — the shape of the
 * melody, the rhythm and where the attacks land — and not the voice itself. So
 * every feature here is deliberately invariant to timbre and to absolute pitch:
 * a deep voice and a high voice tracing the same curve must score the same.
 *
 * Pure functions over Float32Array only, so this can be unit-tested outside a
 * browser. Decoding lives in mimic-audio.ts.
 */

export interface Features {
  /** Pitch per frame in semitones, relative to the take's own median. NaN when unvoiced. */
  pitch: Float32Array;
  /** Loudness per frame, normalised to its own peak (0-1). */
  energy: Float32Array;
  /** Frames per second. */
  frameRate: number;
}

export interface MimicScore {
  /** How closely the melody contour matches (0-100). */
  melody: number;
  /** How closely the loudness shape / attacks match (0-100). */
  rhythm: number;
  /** Whether you sang at all, and for roughly the right length (0-100). */
  effort: number;
  /** Weighted blend, 0-100. */
  total: number;
}

const FRAME = 1024;   // ~64ms at 16kHz
const HOP = 256;      // ~16ms at 16kHz
// Range covers a deep bass through a soprano. Too narrow a ceiling silently
// clips high notes, which then get reported an octave down and wreck the contour.
const MIN_F0 = 65;
const MAX_F0 = 1100;

/* --------------------------------------------------------------- band-pass */

// A vocal band, wide enough to hold a deep bass fundamental at the bottom and
// the top of the tracker's range at the ceiling. Real scene audio is a mix, and
// autocorrelation locks onto whatever is most strongly periodic in the frame —
// usually the bassline or the kick, not the line the player is being asked to
// copy. Restricting the signal to the band a voice actually lives in leaves the
// voice as the strongest periodic thing there.
const BAND_LOW = 80;
const BAND_HIGH = 1100;

/**
 * One biquad section, run forward and then backward.
 *
 * Running it in both directions cancels the phase shift exactly. That matters
 * more here than the sharper rolloff does: the rhythm half of the score is
 * compared at fixed alignment, so a filter with group delay would slide the
 * envelope along the time axis and be read as a timing error.
 */
function biquadFiltFilt(x: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): Float32Array {
  const n = x.length;
  const out = new Float32Array(n);

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    const v = x[i];
    const y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    out[i] = y;
  }

  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  for (let i = n - 1; i >= 0; i--) {
    const v = out[i];
    const y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** Second-order Butterworth sections, RBJ cookbook coefficients. */
export function bandPass(samples: Float32Array, sampleRate: number): Float32Array {
  const Q = Math.SQRT1_2;
  const section = (freq: number, high: boolean, input: Float32Array) => {
    // Above Nyquist the section has nothing to do and the coefficients blow up.
    if (freq <= 0 || freq >= sampleRate / 2) return input;
    const w0 = (2 * Math.PI * freq) / sampleRate;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Q);
    const a0 = 1 + alpha;
    const b0 = high ? (1 + cos) / 2 : (1 - cos) / 2;
    const b1 = high ? -(1 + cos) : 1 - cos;
    return biquadFiltFilt(input, b0 / a0, b1 / a0, b0 / a0, (-2 * cos) / a0, (1 - alpha) / a0);
  };
  return section(BAND_HIGH, false, section(BAND_LOW, true, samples));
}

/**
 * Find the most singable stretch of a longer recording.
 *
 * A 90-second anime opening or a soundboard clip with a run-up cannot be used
 * as a reference whole, and its first few seconds are usually the worst part —
 * an intro, a sound effect, or silence. So pick the window instead of assuming
 * the front of the file.
 *
 * Loudness *inside the vocal band* is the signal: it separates a sung chorus
 * from a drum fill in a way plain amplitude does not. The per-frame energy is
 * square-rooted before averaging, which is what makes this prefer a window
 * that is consistently loud over one containing a single loud crash.
 *
 * @returns the start of the best window, in seconds.
 */
export function pickBestWindow(samples: Float32Array, sampleRate: number, windowSec: number): number {
  const total = samples.length / sampleRate;
  if (total <= windowSec) return 0;

  const voiceBand = bandPass(samples, sampleRate);
  const frames = Math.max(1, Math.floor((voiceBand.length - FRAME) / HOP) + 1);
  const level = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const start = f * HOP;
    let sum = 0;
    for (let i = start; i < start + FRAME; i++) sum += voiceBand[i] * voiceBand[i];
    // sqrt of RMS: concave, so consistency beats a single spike.
    level[f] = Math.sqrt(Math.sqrt(sum / FRAME));
  }

  const span = Math.max(1, Math.round((windowSec * sampleRate) / HOP));
  if (span >= frames) return 0;

  // Prefix sums keep this linear no matter how long the track is.
  const cum = new Float64Array(frames + 1);
  for (let f = 0; f < frames; f++) cum[f + 1] = cum[f] + level[f];

  let bestStart = 0;
  let bestScore = -1;
  for (let f = 0; f + span <= frames; f++) {
    const score = cum[f + span] - cum[f];
    if (score > bestScore) { bestScore = score; bestStart = f; }
  }
  const seconds = (bestStart * HOP) / sampleRate;
  // Never run off the end: the caller is going to slice windowSec from here.
  return Math.max(0, Math.min(seconds, total - windowSec));
}

/**
 * Frame-wise fundamental frequency by normalised autocorrelation.
 * Cheap, and accurate enough for "did they follow the tune".
 */
function detectPitch(frame: Float32Array, sampleRate: number): number {
  const minLag = Math.floor(sampleRate / MAX_F0);
  const maxLag = Math.min(Math.floor(sampleRate / MIN_F0), frame.length - 1);

  let energy = 0;
  for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i];
  if (energy < 1e-6) return 0; // silence

  const scores = new Float32Array(maxLag + 1);
  let bestLag = -1;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let norm = 0;
    for (let i = 0; i + lag < frame.length; i++) {
      corr += frame[i] * frame[i + lag];
      norm += frame[i + lag] * frame[i + lag];
    }
    // Normalising by the lagged window's energy stops long lags from winning by default.
    const score = norm > 1e-9 ? corr / Math.sqrt(norm * energy) : 0;
    scores[lag] = score;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }

  // Below this the frame is noise or a consonant, not a pitched sound.
  if (bestLag < 0 || bestScore < 0.35) return 0;

  // Autocorrelation peaks just as strongly at 2x and 3x the true period, which
  // reports the note an octave (or a twelfth) too low and wrecks the contour.
  // Prefer the shortest lag that is nearly as good as the best one.
  const ACCEPT = 0.86;
  for (let lag = minLag; lag < bestLag; lag++) {
    if (scores[lag] >= bestScore * ACCEPT) {
      // Only accept it if it is genuinely a peak, not the shoulder of one.
      if (scores[lag] >= scores[lag - 1] && scores[lag] >= scores[lag + 1]) {
        return sampleRate / lag;
      }
    }
  }
  return sampleRate / bestLag;
}

export function extractFeatures(samples: Float32Array, sampleRate: number): Features {
  const frames = Math.max(0, Math.floor((samples.length - FRAME) / HOP) + 1);
  const pitch = new Float32Array(frames);
  const energy = new Float32Array(frames);
  const hz: number[] = [];

  // Pitch is tracked on the vocal band only, so a bassline underneath a film
  // clip cannot outvote the voice. Loudness stays on the raw signal: the
  // envelope is what the ear hears cueing the attacks, and the score is a
  // comparison between two takes that are both measured the same way.
  const voiceBand = bandPass(samples, sampleRate);

  for (let f = 0; f < frames; f++) {
    const start = f * HOP;
    const frame = samples.subarray(start, start + FRAME);

    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    energy[f] = Math.sqrt(sum / frame.length);

    const f0 = detectPitch(voiceBand.subarray(start, start + FRAME), sampleRate);
    pitch[f] = f0;
    if (f0 > 0) hz.push(f0);
  }

  // Normalise pitch against the performer's own median, in semitones. This is
  // what makes the score independent of how high or low someone's voice sits.
  const median = hz.length ? hz.slice().sort((a, b) => a - b)[Math.floor(hz.length / 2)] : 0;
  for (let f = 0; f < frames; f++) {
    pitch[f] = pitch[f] > 0 && median > 0 ? 12 * Math.log2(pitch[f] / median) : NaN;
  }

  // Normalise loudness to the take's own peak, so mic gain does not matter.
  let peak = 0;
  for (let f = 0; f < frames; f++) if (energy[f] > peak) peak = energy[f];
  if (peak > 0) for (let f = 0; f < frames; f++) energy[f] /= peak;

  return { pitch, energy, frameRate: sampleRate / HOP };
}

/**
 * Dynamic time warping distance between two contours, normalised by path length.
 * Lets someone be slightly early or late without being punished for it.
 */
function dtwDistance(a: number[], b: number[], maxDist: number): number {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return maxDist;

  // Sakoe-Chiba band: allow drift of up to 20% of the length, keeps it O(n*band).
  const band = Math.max(4, Math.floor(Math.max(n, m) * 0.2));
  const INF = Infinity;
  let prev = new Float64Array(m + 1).fill(INF);
  let curr = new Float64Array(m + 1).fill(INF);
  prev[0] = 0;

  for (let i = 1; i <= n; i++) {
    curr.fill(INF);
    const lo = Math.max(1, i - band);
    const hi = Math.min(m, i + band);
    for (let j = lo; j <= hi; j++) {
      const cost = Math.min(Math.abs(a[i - 1] - b[j - 1]), maxDist);
      curr[j] = cost + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    const swap = prev; prev = curr; curr = swap;
  }
  const total = prev[m];
  return Number.isFinite(total) ? total / Math.max(n, m) : maxDist;
}

/** Resample a contour to a fixed length so takes of different lengths compare. */
function resample(values: number[], length: number): number[] {
  if (!values.length) return new Array(length).fill(0);
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const pos = (i / (length - 1 || 1)) * (values.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(values.length - 1, lo + 1);
    out.push(values[lo] + (values[hi] - values[lo]) * (pos - lo));
  }
  return out;
}

/** Fill unvoiced gaps by holding the last known pitch, so DTW sees a continuous line. */
function fillGaps(pitch: Float32Array): number[] {
  const out: number[] = [];
  let last = 0;
  for (let i = 0; i < pitch.length; i++) {
    if (Number.isNaN(pitch[i])) out.push(last);
    else { last = pitch[i]; out.push(pitch[i]); }
  }
  return out;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pct = (v: number) => Math.round(clamp01(v) * 100);

/** Pearson correlation — measures whether two contours have the same *shape*. */
function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  // A flat line has no variance, so it cannot match any shape.
  if (da < 1e-6 || db < 1e-6) return 0;
  return num / Math.sqrt(da * db);
}

/** Standard deviation of a contour — how much tune there actually is to trace. */
function spread(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let mean = 0;
  for (const v of values) mean += v;
  mean /= n;
  let sq = 0;
  for (const v of values) sq += (v - mean) * (v - mean);
  return Math.sqrt(sq / n);
}

/** Positive energy jumps — where the attacks are. */
function onsets(energy: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < energy.length; i++) out.push(Math.max(0, energy[i] - energy[i - 1]));
  return out;
}

export function scoreTake(ref: Features, take: Features): MimicScore {
  const refVoiced = ref.pitch.reduce((n, p) => n + (Number.isNaN(p) ? 0 : 1), 0);
  const takeVoiced = take.pitch.reduce((n, p) => n + (Number.isNaN(p) ? 0 : 1), 0);

  // Nothing usable came out of the microphone.
  if (takeVoiced < 3 || take.energy.length < 4) {
    return { melody: 0, rhythm: 0, effort: 0, total: 0 };
  }

  const LEN = 64;
  const refPitch = resample(fillGaps(ref.pitch), LEN);
  const takePitch = resample(fillGaps(take.pitch), LEN);
  const refEnergy = resample(Array.from(ref.energy), LEN);
  const takeEnergy = resample(Array.from(take.energy), LEN);

  // --- Melody -------------------------------------------------------------
  // Time-warped so being slightly early or late is forgiven, combined with a
  // shape correlation so a flat drone cannot score well just by sitting near
  // the average pitch.
  const melodyErr = dtwDistance(refPitch, takePitch, 12);
  const melodyDist = clamp01(1 - melodyErr / 5);
  const melodyShape = clamp01(correlation(refPitch, takePitch));

  // Some references hold one note the whole way through — an alarm clock or a
  // reversing truck is rhythm, not tune. There is no contour to trace, so
  // correlating against it measures nothing, and correlation()'s flat-line
  // guard would hand a note-perfect copy a zero. When the reference is flat,
  // the pitch distance carries melody on its own and rhythm decides the round.
  // The built-in one-note sounds sit under 0.2 semitones of spread and the
  // melodic ones above 0.85, so this threshold is not a close call.
  const refHasTune = spread(refPitch) >= 0.4;
  const melody = pct(refHasTune ? melodyDist * 0.45 + melodyShape * 0.55 : melodyDist);

  // --- Rhythm -------------------------------------------------------------
  // Deliberately NOT time-warped: warping would absorb exactly the timing
  // errors this is supposed to catch. Compared at fixed alignment instead.
  let envErr = 0;
  for (let i = 0; i < LEN; i++) envErr += Math.abs(refEnergy[i] - takeEnergy[i]);
  envErr /= LEN;
  const envScore = clamp01(1 - envErr / 0.34);

  const onsetScore = clamp01(correlation(onsets(refEnergy), onsets(takeEnergy)));
  const rhythm = pct(envScore * 0.55 + onsetScore * 0.45);

  // --- Effort -------------------------------------------------------------
  // A gate rather than free points: singing for the right length and actually
  // making pitched sound is the price of entry, not a third of the score.
  const lengthRatio = Math.min(take.pitch.length, ref.pitch.length) /
                      Math.max(take.pitch.length, ref.pitch.length, 1);
  const voicedRatio = clamp01(takeVoiced / Math.max(1, refVoiced));
  const effort = pct(lengthRatio * 0.5 + Math.min(1, voicedRatio) * 0.5);

  const core = melody * 0.62 + rhythm * 0.38;
  // Scale by effort, but never wipe out a real attempt entirely.
  const gate = 0.55 + 0.45 * clamp01(effort / 100);
  return { melody, rhythm, effort, total: Math.round(core * gate) };
}

'use client';

/**
 * Browser audio for the Mimic round: rendering the reference sounds, pulling
 * analysable samples out of recordings, and the sabotage effects.
 */

import type { SoundRecipe } from './mimic-sounds';
import { recipeDuration } from './mimic-sounds';
import { pickBestWindow } from './mimic-dsp';
import { getClip } from './mimic-clips';
import type { MimicRef } from './mimic-refs';

export const ANALYSIS_RATE = 16000;
const RENDER_RATE = 44100;

let sharedCtx: AudioContext | null = null;
export function audioCtx(): AudioContext {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!sharedCtx) sharedCtx = new Ctor();
  if (sharedCtx.state === 'suspended') void sharedCtx.resume();
  return sharedCtx;
}

/** Render a recipe to an AudioBuffer. Deterministic, so every device hears the same thing. */
export async function renderRecipe(recipe: SoundRecipe, sampleRate = RENDER_RATE): Promise<AudioBuffer> {
  const total = recipeDuration(recipe) + 0.2;
  const OfflineCtor = window.OfflineAudioContext
    ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OfflineCtor(1, Math.ceil(total * sampleRate), sampleRate);

  let t = 0;
  for (const seg of recipe.segs) {
    if (seg.hz > 0 && seg.dur > 0.005) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = seg.wave ?? 'triangle';
      osc.frequency.setValueAtTime(seg.hz, t);
      if (seg.to && seg.to !== seg.hz) osc.frequency.exponentialRampToValueAtTime(Math.max(20, seg.to), t + seg.dur);

      // Short attack and release keep each note distinct, which is what the
      // rhythm half of the score reads.
      const peak = seg.gain ?? 0.5;
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, seg.dur * 0.2));
      amp.gain.setValueAtTime(peak, t + seg.dur * 0.75);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + seg.dur);

      osc.connect(amp).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + seg.dur + 0.01);
    }
    t += seg.dur + (seg.gap ?? 0);
  }
  return ctx.startRendering();
}

/** Average-decimate to the analysis rate, mono. */
export function toAnalysisSamples(buffer: AudioBuffer): Float32Array {
  const src = buffer.getChannelData(0);
  const ratio = buffer.sampleRate / ANALYSIS_RATE;
  if (ratio <= 1) return Float32Array.from(src);
  const out = new Float32Array(Math.floor(src.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(src.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += src[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export async function decodeBlob(blob: Blob): Promise<AudioBuffer | null> {
  try {
    return await audioCtx().decodeAudioData(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------- clips */

/** The window the round copies. Anything shorter is not a phrase; longer is not one shot. */
export const CLIP_MIN = 2;
export const CLIP_MAX = 6;
export const clampClipLength = (sec: number) => Math.max(CLIP_MIN, Math.min(CLIP_MAX, sec));

/**
 * Route a remote file through the app's own origin.
 *
 * Playing remote audio only needs an <audio> element, but scoring against it
 * needs the samples, and neither CDN we pull from sends an
 * Access-Control-Allow-Origin header — so a direct fetch is blocked whatever
 * we do on this side. See src/app/api/clip/route.ts.
 */
export const relayUrl = (url: string) => `/api/clip?u=${encodeURIComponent(url)}`;

/** Decoded references, kept for the session so replaying one does not refetch. */
const bufferCache = new Map<string, AudioBuffer>();

export async function decodeUrl(url: string): Promise<AudioBuffer> {
  const res = await fetch(relayUrl(url));
  if (!res.ok) throw new Error(`Could not load the audio (${res.status}).`);
  const bytes = await res.arrayBuffer();
  try {
    return await audioCtx().decodeAudioData(bytes);
  } catch {
    throw new Error('That audio could not be decoded by this browser.');
  }
}

/** Decode a file the user picked. Video containers work too — we only keep the audio. */
export async function decodeFile(file: File): Promise<AudioBuffer> {
  const bytes = await file.arrayBuffer();
  try {
    return await audioCtx().decodeAudioData(bytes);
  } catch {
    throw new Error(`${file.name} is not audio this browser can decode.`);
  }
}

/**
 * Cut a window out of a buffer, mixed to mono.
 *
 * Mono because the scorer analyses channel 0 only, and taking the left channel
 * of a stereo mix can quietly drop a centre-panned voice. The short fades are
 * there because a cut across a waveform is a click, and a click is a single
 * enormous transient — which would then become the peak that the loudness
 * normalisation divides everything else by.
 */
export function sliceBuffer(buffer: AudioBuffer, startSec: number, lengthSec: number): AudioBuffer {
  const rate = buffer.sampleRate;
  const start = Math.max(0, Math.min(buffer.length - 1, Math.floor(startSec * rate)));
  const length = Math.max(1, Math.min(buffer.length - start, Math.floor(lengthSec * rate)));

  const Ctor = window.AudioBuffer ?? null;
  const out = Ctor
    ? new Ctor({ length, sampleRate: rate, numberOfChannels: 1 })
    : audioCtx().createBuffer(1, length, rate);
  const dst = out.getChannelData(0);

  const channels = buffer.numberOfChannels;
  for (let c = 0; c < channels; c++) {
    const src = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) dst[i] += src[start + i] / channels;
  }

  const fade = Math.min(Math.floor(rate * 0.012), Math.floor(length / 8));
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    dst[i] *= g;
    dst[length - 1 - i] *= g;
  }
  return out;
}

/** 16-bit PCM WAV — the one container every browser can decode without argument. */
export function encodeWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);

  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);      // PCM header size
  view.setUint16(20, 1, true);       // format: PCM
  view.setUint16(22, 1, true);       // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // byte rate
  view.setUint16(32, 2, true);        // block align
  view.setUint16(34, 16, true);       // bits per sample
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

/**
 * Turn any reference into the audio the round plays and grades against.
 *
 * Recipes render, saved clips come out of IndexedDB already trimmed, and
 * remote audio is fetched through the relay and cut down to a window — one
 * chosen from the sound itself when the entry does not name one.
 */
export async function resolveRef(ref: MimicRef): Promise<AudioBuffer> {
  const cached = bufferCache.get(ref.id);
  if (cached) return cached;

  let buffer: AudioBuffer;

  if (ref.recipe) {
    buffer = await renderRecipe(ref.recipe);
  } else if (ref.clipId) {
    const stored = await getClip(ref.clipId);
    if (!stored) throw new Error('That clip is no longer saved in this browser.');
    const decoded = await decodeBlob(stored.blob);
    if (!decoded) throw new Error('That saved clip could not be decoded.');
    buffer = decoded;
  } else if (ref.url) {
    const full = await decodeUrl(ref.url);
    const want = clampClipLength(
      ref.start !== undefined && ref.end !== undefined ? ref.end - ref.start : CLIP_MAX,
    );
    if (full.duration <= want + 0.05 && ref.start === undefined) {
      buffer = sliceBuffer(full, 0, full.duration);
    } else {
      const start = ref.start !== undefined
        ? ref.start
        : pickBestWindow(toAnalysisSamples(full), ANALYSIS_RATE, Math.min(want, full.duration));
      buffer = sliceBuffer(full, start, want);
    }
  } else {
    throw new Error('That sound has no audio attached.');
  }

  bufferCache.set(ref.id, buffer);
  return buffer;
}

/** Drop a cached reference — used when a saved clip is re-cut or deleted. */
export function forgetRef(id: string): void {
  bufferCache.delete(id);
}

/* ------------------------------------------------------------- sabotages */

export type Sabotage = 'echo' | 'pitch' | 'saturate' | 'chop' | 'fart' | null;

export const SABOTAGE_INFO: Record<Exclude<Sabotage, null>, { name: string; emoji: string; blurb: string }> = {
  echo:     { name: 'Cathedral', emoji: '🌀', blurb: 'Their take comes back drowning in echo' },
  pitch:    { name: 'Chipmunk',  emoji: '🐿️', blurb: 'Their take plays back sped up and squeaky' },
  saturate: { name: 'Blown out', emoji: '📢', blurb: 'Their take is distorted into mush' },
  chop:     { name: 'Chopped',   emoji: '✂️', blurb: 'Their take is cut to pieces' },
  fart:     { name: 'Replaced',  emoji: '💨', blurb: 'Nobody hears their take at all' },
};

/** A soft-clip curve for the saturation sabotage. */
function distortionCurve(amount = 60): Float32Array {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * Math.PI) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/** The replacement sound when a take is sabotaged out of existence. */
function playRaspberry(ctx: AudioContext, out: AudioNode, when: number) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoAmp = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(90, when);
  osc.frequency.exponentialRampToValueAtTime(55, when + 0.75);
  lfo.type = 'square';
  lfo.frequency.setValueAtTime(22, when);
  lfoAmp.gain.value = 28;
  lfo.connect(lfoAmp).connect(osc.frequency);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(0.35, when + 0.04);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.8);
  osc.connect(amp).connect(out);
  osc.start(when); osc.stop(when + 0.85);
  lfo.start(when); lfo.stop(when + 0.85);
}

/**
 * Play a take, optionally mangled. Resolves when playback finishes.
 */
export function playTake(buffer: AudioBuffer, sabotage: Sabotage): Promise<void> {
  const ctx = audioCtx();
  const now = ctx.currentTime + 0.05;

  if (sabotage === 'fart') {
    playRaspberry(ctx, ctx.destination, now);
    return new Promise((r) => setTimeout(r, 950));
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  let node: AudioNode = src;
  const master = ctx.createGain();
  master.gain.value = 1;

  if (sabotage === 'pitch') src.playbackRate.value = 1.55;

  if (sabotage === 'saturate') {
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(80);
    shaper.oversample = '4x';
    const tame = ctx.createGain();
    tame.gain.value = 0.22;
    node.connect(shaper).connect(tame);
    node = tame;
  }

  if (sabotage === 'chop') {
    // Gate the signal on and off so the take arrives in shreds.
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(1, now);
    const dur = buffer.duration / src.playbackRate.value;
    for (let t = 0; t < dur; t += 0.16) {
      gate.gain.setValueAtTime(1, now + t);
      gate.gain.setValueAtTime(0, now + t + 0.08);
    }
    node.connect(gate);
    node = gate;
  }

  node.connect(master);

  if (sabotage === 'echo') {
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.19;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.62;
    const wet = ctx.createGain();
    wet.gain.value = 0.75;
    node.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(ctx.destination);
  }

  master.connect(ctx.destination);
  src.start(now);

  const tail = sabotage === 'echo' ? 1.4 : 0.1;
  const playSeconds = buffer.duration / src.playbackRate.value + tail;
  return new Promise((resolve) => {
    setTimeout(resolve, playSeconds * 1000);
  });
}

/** Straight playback of a rendered AudioBuffer. */
export function playBuffer(buffer: AudioBuffer): Promise<void> {
  const ctx = audioCtx();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  return new Promise((resolve) => { src.onended = () => resolve(); });
}

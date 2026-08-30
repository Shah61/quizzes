'use client';

/**
 * One place that decides how loud the game is.
 *
 * Sound comes out of this app by three different routes — synthesised effects
 * in sfx.ts, decoded buffers in mimic-audio.ts, and plain <audio>/<video>
 * elements for the openings and voice takes — across two AudioContexts. A
 * volume control that only knew about one of them would be a lie, so everything
 * that plays is routed through here instead.
 *
 * What is deliberately *not* routed through here: the OfflineAudioContext in
 * renderRecipe(). That render is the reference the scorer grades against, not
 * something anybody hears, and putting a user-controlled gain in front of it
 * would make the volume slider part of the scoring path.
 */

export interface VolumeState {
  /** Everything, 0-1. */
  master: number;
  /** Interface beeps and buzzers on top of master, 0-1. */
  effects: number;
  muted: boolean;
}

const KEY = 'quiz-arena-volume';

const DEFAULTS: VolumeState = { master: 0.8, effects: 0.7, muted: false };

interface Bus { master: GainNode; effects: GainNode }

/**
 * The store lives on a global rather than in module scope.
 *
 * This module is imported both by the game modules and by the React tree, and
 * a bundler splitting those into different chunks — or a dev-server hot reload
 * re-evaluating the file — gives you two copies of it. That failure is silent
 * and confusing: the slider updates its own copy's state and writes it to
 * storage, while the copy holding the actual gain nodes never hears about it,
 * so the setting looks like it saved and nothing gets quieter. Keying off a
 * registered symbol means every copy shares one store.
 */
interface Store {
  state: VolumeState;
  restored: boolean;
  listeners: Set<() => void>;
  buses: WeakMap<AudioContext, Bus>;
  contexts: Set<AudioContext>;
  elements: Set<HTMLMediaElement>;
}

const GLOBAL_KEY = Symbol.for('quiz-arena.volume');

function store(): Store {
  const holder = globalThis as unknown as Record<symbol, Store | undefined>;
  let s = holder[GLOBAL_KEY];
  if (!s) {
    s = {
      state: { ...DEFAULTS },
      restored: false,
      listeners: new Set(),
      buses: new WeakMap(),
      contexts: new Set(),
      elements: new Set(),
    };
    holder[GLOBAL_KEY] = s;
  }
  return s;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** Read the saved setting once, lazily, so this module stays safe to import on the server. */
function restore(): void {
  const s = store();
  if (s.restored || typeof window === 'undefined') return;
  s.restored = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<VolumeState>;
    s.state = {
      master: clamp01(saved.master ?? DEFAULTS.master),
      effects: clamp01(saved.effects ?? DEFAULTS.effects),
      muted: Boolean(saved.muted),
    };
  } catch {
    // Corrupt or blocked storage is not worth failing over — the defaults play fine.
  }
}

export function subscribeVolume(fn: () => void): () => void {
  const s = store();
  s.listeners.add(fn);
  return () => { s.listeners.delete(fn); };
}

export function getVolume(): VolumeState {
  restore();
  return store().state;
}

/** Master, with mute folded in — the number every output actually wants. */
const outputLevel = () => {
  const { muted, master } = store().state;
  return muted ? 0 : master;
};

export function setVolume(patch: Partial<VolumeState>): void {
  restore();
  const s = store();
  const cur = s.state;
  const next: VolumeState = {
    master: patch.master !== undefined ? clamp01(patch.master) : cur.master,
    effects: patch.effects !== undefined ? clamp01(patch.effects) : cur.effects,
    muted: patch.muted !== undefined ? patch.muted : cur.muted,
  };
  // Dragging a slider back up is the clearest possible "unmute".
  if (patch.master !== undefined && patch.master > 0 && patch.muted === undefined) next.muted = false;
  s.state = next;

  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows can refuse; the setting just will not survive a reload.
  }
  apply();
  for (const fn of s.listeners) fn();
}

export const toggleMute = () => setVolume({ muted: !getVolume().muted });

/** Nudge by a step, for the keyboard shortcuts. */
export function bumpVolume(delta: number): void {
  const v = getVolume();
  setVolume({ master: clamp01(v.master + delta), muted: false });
  void v;
}

/* ------------------------------------------------------------ web audio */

// Keyed by context so each AudioContext gets its own pair of nodes; weak so a
// context that goes away does not keep them alive.
function busFor(ctx: AudioContext): Bus {
  const s = store();
  let bus = s.buses.get(ctx);
  if (!bus) {
    const master = ctx.createGain();
    const effects = ctx.createGain();
    master.connect(ctx.destination);
    effects.connect(master);
    bus = { master, effects };
    s.buses.set(ctx, bus);
    s.contexts.add(ctx);
    applyTo(bus, ctx);
  }
  return bus;
}

function applyTo(bus: Bus, ctx: AudioContext): void {
  // A short ramp rather than a jump: setting gain outright while something is
  // playing is an audible click.
  const now = ctx.currentTime;
  bus.master.gain.setTargetAtTime(outputLevel(), now, 0.015);
  bus.effects.gain.setTargetAtTime(store().state.effects, now, 0.015);
}

/** Connect anything you want to hear to this instead of ctx.destination. */
export function masterGain(ctx: AudioContext): GainNode {
  restore();
  return busFor(ctx).master;
}

/** Interface sounds, which get their own level on top of master. */
export function effectsGain(ctx: AudioContext): GainNode {
  restore();
  return busFor(ctx).effects;
}

/* -------------------------------------------------------- media elements */

// <audio>/<video> cannot join the graph without tainting on cross-origin media,
// so their level is set directly and kept in step by hand.
export function bindMediaElement(el: HTMLMediaElement): () => void {
  restore();
  const s = store();
  s.elements.add(el);
  el.volume = outputLevel();
  return () => { s.elements.delete(el); };
}

function apply(): void {
  const s = store();
  for (const ctx of s.contexts) {
    const bus = s.buses.get(ctx);
    if (bus) applyTo(bus, ctx);
  }
  for (const el of s.elements) el.volume = outputLevel();
}

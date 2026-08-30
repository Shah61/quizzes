/**
 * Reference sounds for the Mimic round.
 *
 * These are synthesised from recipes rather than shipped as audio files: they
 * render instantly, weigh nothing, are the same on every device, and — most
 * importantly — they are pure pitch and rhythm, which is exactly what the
 * scorer grades. A human throat can actually chase them.
 */

export interface Segment {
  /** Starting frequency in Hz. */
  hz: number;
  /** Glide to this frequency across the segment. Omit to hold. */
  to?: number;
  /** Seconds. */
  dur: number;
  /** Silence after this segment, in seconds. */
  gap?: number;
  wave?: OscillatorType;
  gain?: number;
}

export interface SoundRecipe {
  id: string;
  name: string;
  pack: PackId;
  emoji: string;
  segs: Segment[];
  /** 1 = easy to copy, 3 = awkward. */
  level: 1 | 2 | 3;
}

export type PackId = 'animals' | 'machines' | 'anime' | 'melodies';

export const PACKS: Record<PackId, { name: string; emoji: string }> = {
  animals: { name: 'Animals', emoji: '🐾' },
  machines: { name: 'Machines', emoji: '🤖' },
  anime: { name: 'Anime & Games', emoji: '⚔️' },
  melodies: { name: 'Melodies', emoji: '🎵' },
};

/** Build a run of flat notes from a list of [hz, seconds]. */
const notes = (list: [number, number][], gap = 0.04, wave: OscillatorType = 'triangle'): Segment[] =>
  list.map(([hz, dur]) => ({ hz, dur, gap, wave }));

export const SOUNDS: SoundRecipe[] = [
  /* ---------------------------------------------------------- animals */
  { id: 'dog', name: 'Dog barking', pack: 'animals', emoji: '🐶', level: 1, segs: [
    { hz: 300, to: 180, dur: 0.16, gap: 0.14, wave: 'sawtooth' },
    { hz: 300, to: 180, dur: 0.16, gap: 0.14, wave: 'sawtooth' },
    { hz: 320, to: 170, dur: 0.22, wave: 'sawtooth' },
  ]},
  { id: 'cat', name: 'Cat meowing', pack: 'animals', emoji: '🐱', level: 1, segs: [
    { hz: 420, to: 700, dur: 0.35 }, { hz: 700, to: 380, dur: 0.5 },
  ]},
  { id: 'cow', name: 'Cow mooing', pack: 'animals', emoji: '🐄', level: 1, segs: [
    { hz: 180, to: 150, dur: 0.9, wave: 'sawtooth' },
  ]},
  { id: 'rooster', name: 'Rooster crowing', pack: 'animals', emoji: '🐔', level: 2, segs: [
    { hz: 500, dur: 0.2 }, { hz: 700, dur: 0.25 }, { hz: 620, to: 400, dur: 0.45 },
  ]},
  { id: 'owl', name: 'Owl hooting', pack: 'animals', emoji: '🦉', level: 1, segs: [
    { hz: 300, to: 260, dur: 0.35, gap: 0.25, wave: 'sine' },
    { hz: 300, to: 250, dur: 0.45, wave: 'sine' },
  ]},
  { id: 'sheep', name: 'Sheep bleating', pack: 'animals', emoji: '🐑', level: 2, segs: [
    { hz: 420, dur: 0.12, gap: 0.05 }, { hz: 400, dur: 0.1, gap: 0.05 },
    { hz: 430, dur: 0.1, gap: 0.05 }, { hz: 390, to: 330, dur: 0.35 },
  ]},
  { id: 'wolf', name: 'Wolf howling', pack: 'animals', emoji: '🐺', level: 1, segs: [
    { hz: 260, to: 440, dur: 0.6 }, { hz: 440, dur: 0.7 }, { hz: 440, to: 300, dur: 0.5 },
  ]},
  { id: 'frog', name: 'Frog croaking', pack: 'animals', emoji: '🐸', level: 2, segs: [
    { hz: 140, dur: 0.18, gap: 0.12, wave: 'square' },
    { hz: 140, dur: 0.18, gap: 0.12, wave: 'square' },
    { hz: 130, dur: 0.22, wave: 'square' },
  ]},
  { id: 'bird', name: 'Bird chirping', pack: 'animals', emoji: '🐦', level: 2, segs: [
    { hz: 900, to: 1050, dur: 0.1, gap: 0.08 }, { hz: 950, to: 800, dur: 0.1, gap: 0.08 },
    { hz: 1000, to: 1100, dur: 0.12 },
  ]},
  { id: 'monkey', name: 'Monkey chattering', pack: 'animals', emoji: '🐵', level: 3, segs: [
    { hz: 600, to: 800, dur: 0.1, gap: 0.06 }, { hz: 700, to: 550, dur: 0.1, gap: 0.06 },
    { hz: 800, to: 900, dur: 0.1, gap: 0.06 }, { hz: 650, to: 480, dur: 0.16 },
  ]},

  /* --------------------------------------------------------- machines */
  { id: 'siren', name: 'Police siren', pack: 'machines', emoji: '🚨', level: 1, segs: [
    { hz: 400, to: 800, dur: 0.5 }, { hz: 800, to: 400, dur: 0.5 },
  ]},
  { id: 'ambulance', name: 'Ambulance', pack: 'machines', emoji: '🚑', level: 1, segs: [
    { hz: 660, dur: 0.35, gap: 0.03 }, { hz: 500, dur: 0.35, gap: 0.03 },
    { hz: 660, dur: 0.35, gap: 0.03 }, { hz: 500, dur: 0.35 },
  ]},
  { id: 'alarm', name: 'Alarm clock', pack: 'machines', emoji: '⏰', level: 1, segs: [
    { hz: 880, dur: 0.12, gap: 0.1, wave: 'square' }, { hz: 880, dur: 0.12, gap: 0.1, wave: 'square' },
    { hz: 880, dur: 0.12, gap: 0.1, wave: 'square' }, { hz: 880, dur: 0.12, wave: 'square' },
  ]},
  { id: 'phone', name: 'Old telephone', pack: 'machines', emoji: '☎️', level: 2, segs: [
    { hz: 480, dur: 0.4, gap: 0.18 }, { hz: 480, dur: 0.4 },
  ]},
  { id: 'engine', name: 'Engine revving', pack: 'machines', emoji: '🏎️', level: 2, segs: [
    { hz: 110, to: 330, dur: 0.5, wave: 'sawtooth' }, { hz: 330, to: 130, dur: 0.3, wave: 'sawtooth' },
    { hz: 130, to: 420, dur: 0.6, wave: 'sawtooth' },
  ]},
  { id: 'laser', name: 'Laser blast', pack: 'machines', emoji: '🔫', level: 1, segs: [
    { hz: 1200, to: 200, dur: 0.22, gap: 0.1, wave: 'sawtooth' },
    { hz: 1200, to: 200, dur: 0.22, wave: 'sawtooth' },
  ]},
  { id: 'doorbell', name: 'Doorbell', pack: 'machines', emoji: '🔔', level: 1, segs: [
    { hz: 660, dur: 0.35, gap: 0.06 }, { hz: 520, dur: 0.6 },
  ]},
  { id: 'microwave', name: 'Microwave done', pack: 'machines', emoji: '📟', level: 1, segs: [
    { hz: 1000, dur: 0.15, gap: 0.15, wave: 'square' }, { hz: 1000, dur: 0.15, gap: 0.15, wave: 'square' },
    { hz: 1000, dur: 0.15, wave: 'square' },
  ]},
  { id: 'reverse', name: 'Truck reversing', pack: 'machines', emoji: '🚚', level: 1, segs: [
    { hz: 800, dur: 0.2, gap: 0.22, wave: 'square' }, { hz: 800, dur: 0.2, gap: 0.22, wave: 'square' },
    { hz: 800, dur: 0.2, wave: 'square' },
  ]},
  { id: 'startup', name: 'Computer starting', pack: 'machines', emoji: '💻', level: 2, segs: [
    { hz: 330, dur: 0.2 }, { hz: 440, dur: 0.2 }, { hz: 554, dur: 0.2 }, { hz: 660, dur: 0.45 },
  ]},

  /* ------------------------------------------------------------ anime */
  { id: 'powerup', name: 'Powering up', pack: 'anime', emoji: '💥', level: 1, segs: [
    { hz: 150, to: 260, dur: 0.7, wave: 'sawtooth' }, { hz: 260, to: 700, dur: 0.8, wave: 'sawtooth' },
  ]},
  { id: 'attack', name: 'Attack shout', pack: 'anime', emoji: '⚔️', level: 1, segs: [
    { hz: 300, dur: 0.15, gap: 0.06 }, { hz: 380, dur: 0.15, gap: 0.06 }, { hz: 500, to: 260, dur: 0.7 },
  ]},
  { id: 'transform', name: 'Transformation', pack: 'anime', emoji: '✨', level: 2, segs: [
    { hz: 400, to: 1000, dur: 0.4 }, { hz: 600, to: 1200, dur: 0.35 }, { hz: 800, to: 1400, dur: 0.4 },
  ]},
  { id: 'victory', name: 'Victory fanfare', pack: 'anime', emoji: '🏆', level: 1,
    segs: notes([[523, 0.16], [523, 0.16], [523, 0.16], [659, 0.5]]) },
  { id: 'sad', name: 'Sad flute', pack: 'anime', emoji: '😢', level: 2,
    segs: notes([[440, 0.4], [392, 0.3], [349, 0.5], [330, 0.7]], 0.05, 'sine') },
  { id: 'sting', name: 'Dramatic sting', pack: 'anime', emoji: '😱', level: 1, segs: [
    { hz: 200, dur: 0.12, gap: 0.05, wave: 'sawtooth' },
    { hz: 200, dur: 0.12, gap: 0.05, wave: 'sawtooth' },
    { hz: 240, to: 180, dur: 0.6, wave: 'sawtooth' },
  ]},
  { id: 'horn', name: 'Battle horn', pack: 'anime', emoji: '📯', level: 2, segs: [
    { hz: 175, dur: 0.5, wave: 'sawtooth' }, { hz: 233, dur: 0.4, wave: 'sawtooth' },
    { hz: 262, dur: 0.8, wave: 'sawtooth' },
  ]},
  { id: 'heal', name: 'Healing chime', pack: 'anime', emoji: '💚', level: 2,
    segs: notes([[784, 0.15], [988, 0.15], [1175, 0.15], [1568, 0.4]], 0.03, 'sine') },
  { id: 'levelup', name: 'Level up', pack: 'anime', emoji: '⬆️', level: 1,
    segs: notes([[392, 0.12], [523, 0.12], [659, 0.12], [784, 0.35]], 0.02, 'square') },
  { id: 'gameover', name: 'Game over', pack: 'anime', emoji: '💀', level: 2,
    segs: notes([[392, 0.25], [349, 0.25], [311, 0.25], [262, 0.7]], 0.04, 'square') },
  { id: 'coin', name: 'Coin grab', pack: 'anime', emoji: '🪙', level: 1,
    segs: notes([[988, 0.1], [1319, 0.35]], 0.01, 'square') },
  { id: 'charge', name: 'Charging beam', pack: 'anime', emoji: '🔵', level: 3, segs: [
    { hz: 200, to: 300, dur: 1.0, wave: 'sine' }, { hz: 300, to: 1200, dur: 0.4, wave: 'sawtooth' },
  ]},

  /* -------------------------------------------------------- melodies */
  { id: 'mel-rise', name: 'Rising phrase', pack: 'melodies', emoji: '🎵', level: 1,
    segs: notes([[262, 0.3], [330, 0.3], [392, 0.3], [523, 0.5]]) },
  { id: 'mel-fall', name: 'Falling phrase', pack: 'melodies', emoji: '🎶', level: 1,
    segs: notes([[523, 0.3], [440, 0.3], [349, 0.3], [262, 0.5]]) },
  { id: 'mel-wave', name: 'Up and down', pack: 'melodies', emoji: '🌊', level: 2,
    segs: notes([[330, 0.25], [415, 0.25], [494, 0.25], [415, 0.25], [330, 0.45]]) },
  { id: 'mel-skip', name: 'Skipping tune', pack: 'melodies', emoji: '🦘', level: 2,
    segs: notes([[392, 0.2], [523, 0.2], [392, 0.2], [587, 0.2], [392, 0.4]]) },
  { id: 'mel-long', name: 'Long phrase', pack: 'melodies', emoji: '🎼', level: 3,
    segs: notes([[349, 0.22], [392, 0.22], [440, 0.22], [392, 0.22], [349, 0.22], [294, 0.22], [349, 0.5]]) },
  { id: 'mel-leap', name: 'Big leaps', pack: 'melodies', emoji: '🏔️', level: 3,
    segs: notes([[262, 0.25], [523, 0.25], [294, 0.25], [587, 0.25], [330, 0.45]]) },
  { id: 'mel-triplet', name: 'Triplets', pack: 'melodies', emoji: '🥁', level: 2,
    segs: notes([[440, 0.14], [440, 0.14], [440, 0.14], [349, 0.14], [349, 0.14], [349, 0.14], [294, 0.4]]) },
  { id: 'mel-question', name: 'Question and answer', pack: 'melodies', emoji: '❓', level: 2,
    segs: [...notes([[330, 0.22], [392, 0.22], [494, 0.4]]), { hz: 0, dur: 0.001, gap: 0.22 },
           ...notes([[440, 0.22], [392, 0.22], [330, 0.45]])] },
];

export const soundsForPacks = (packs: PackId[]): SoundRecipe[] =>
  SOUNDS.filter((s) => packs.includes(s.pack));

/** Total playing time of a recipe, in seconds. */
export const recipeDuration = (r: SoundRecipe): number =>
  r.segs.reduce((n, s) => n + s.dur + (s.gap ?? 0), 0);

/**
 * Sound effects are synthesised with the Web Audio API rather than shipped as
 * files: no assets to load, no licensing, and they stay crisp at any volume.
 */

let ctx: AudioContext | null = null;
let enabled = true;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Browsers start the context suspended until a user gesture.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSfxEnabled(on: boolean) { enabled = on; }
export function sfxEnabled() { return enabled; }
/** Call from a click handler so later sounds are allowed to play. */
export function primeAudio() { audio(); }

type ToneOpts = {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
};

function tone({ freq, to, dur = 0.16, type = 'sine', gain = 0.22, delay = 0 }: ToneOpts) {
  const ac = audio();
  if (!ac || !enabled) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);

  // Short attack, exponential release — reads as a "blip" rather than a click.
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise(dur = 0.2, gain = 0.14) {
  const ac = audio();
  if (!ac || !enabled) return;
  const frames = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ac.createBufferSource();
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.buffer = buf;
  src.connect(amp).connect(ac.destination);
  src.start();
}

export const sfx = {
  /** Big, urgent buzzer hit. */
  buzz() { tone({ freq: 180, to: 90, dur: 0.34, type: 'square', gain: 0.2 }); noise(0.1, 0.07); },
  /** Rising three-note flourish. */
  correct() {
    tone({ freq: 523, dur: 0.13, type: 'triangle', gain: 0.22 });
    tone({ freq: 659, dur: 0.13, type: 'triangle', gain: 0.22, delay: 0.1 });
    tone({ freq: 880, dur: 0.26, type: 'triangle', gain: 0.24, delay: 0.2 });
  },
  /** Two flat descending notes. */
  wrong() {
    tone({ freq: 220, dur: 0.18, type: 'sawtooth', gain: 0.16 });
    tone({ freq: 150, dur: 0.34, type: 'sawtooth', gain: 0.16, delay: 0.14 });
  },
  tick()   { tone({ freq: 1150, dur: 0.045, type: 'square', gain: 0.07 }); },
  /** Faster, higher tick for the last few seconds. */
  tickUrgent() { tone({ freq: 1500, dur: 0.05, type: 'square', gain: 0.11 }); },
  timeUp() { tone({ freq: 300, to: 110, dur: 0.7, type: 'sawtooth', gain: 0.2 }); noise(0.4, 0.1); },
  reveal() { tone({ freq: 660, to: 1320, dur: 0.28, type: 'sine', gain: 0.16 }); },
  hint()   { tone({ freq: 880, to: 1180, dur: 0.16, type: 'sine', gain: 0.13 }); },
  select() { tone({ freq: 720, dur: 0.06, type: 'square', gain: 0.09 }); },
  start()  {
    tone({ freq: 392, dur: 0.14, type: 'triangle', gain: 0.2 });
    tone({ freq: 523, dur: 0.14, type: 'triangle', gain: 0.2, delay: 0.12 });
    tone({ freq: 784, dur: 0.34, type: 'triangle', gain: 0.22, delay: 0.24 });
  },
  /** Victory fanfare for the podium. */
  fanfare() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => tone({ freq: f, dur: i === notes.length - 1 ? 0.7 : 0.16, type: 'triangle', gain: 0.22, delay: i * 0.13 }));
  },
  bank() {
    tone({ freq: 1047, dur: 0.1, type: 'triangle', gain: 0.2 });
    tone({ freq: 1319, dur: 0.24, type: 'triangle', gain: 0.2, delay: 0.09 });
  },
};

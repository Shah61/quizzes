/**
 * A look per round.
 *
 * Every round gets its own colour, display face and background wash, so that
 * moving from the buzzer round into the map round feels like changing channel
 * rather than changing a heading. The values here are only CSS custom
 * properties and a class name — the components do not branch on the round to
 * style themselves, they just wear whatever this hands them.
 *
 * `font` names a family loaded in layout.tsx. Keep the list short: each face is
 * self-hosted at build time and every extra one is weight on the wire.
 */

import type { RoundKind } from './types';

export interface Theme {
  /** Primary accent — the filled circles, the timers, the glow behind panels. */
  accent: string;
  /** Secondary, used for gradients and the second light source. */
  accent2: string;
  /**
   * Ink for text sitting *on* the accent, since the accents run from near-black
   * violet to bright yellow and one fixed colour cannot read on both.
   */
  onAccent: string;
  /** CSS var name of the display family this round uses. */
  font: string;
  /**
   * Three stops painted over the key art: a glow from the top, a glow from the
   * lower right, and the floor the cards sit against. The floor carries most of
   * the round's identity — it is the largest area of colour on the screen.
   */
  wash: [string, string, string];
  /** A Japanese word for the corner, the way the reference layouts use one. */
  jp: string;
}

/** The house look, used by the menu, setup, and anything without its own. */
export const BASE_THEME: Theme = {
  accent: '#ffc22e',
  accent2: '#ffe49a',
  onAccent: '#1b1305',
  font: 'var(--font-display)',
  wash: ['rgba(255, 194, 46, 0.34)', 'rgba(255, 228, 154, 0.20)', 'rgba(10, 10, 18, 0.74)'],
  jp: 'クイズ',
};

export const ROUND_THEME: Record<RoundKind, Theme> = {
  // Game-show red. Loud, buzzer-pressing, the opening act.
  buzz: {
    accent: '#ff3b5c', accent2: '#ffb02e', onAccent: '#2b0410', font: 'var(--font-impact)',
    wash: ['rgba(255, 59, 92, 0.40)', 'rgba(255, 176, 46, 0.24)', 'rgba(48, 6, 18, 0.80)'],
    jp: 'ブザー',
  },
  // Darkroom violet — something developing out of the blur.
  reveal: {
    accent: '#a855f7', accent2: '#38bdf8', onAccent: '#ffffff', font: 'var(--font-display)',
    wash: ['rgba(168, 85, 247, 0.40)', 'rgba(56, 189, 248, 0.22)', 'rgba(26, 9, 48, 0.80)'],
    jp: 'ピクセル',
  },
  // Stage lights for the music rounds.
  opening: {
    accent: '#22d3ee', accent2: '#a855f7', onAccent: '#04222b', font: 'var(--font-display)',
    wash: ['rgba(34, 211, 238, 0.38)', 'rgba(168, 85, 247, 0.26)', 'rgba(4, 28, 44, 0.80)'],
    jp: 'オープニング',
  },
  // Same stage, dimmed for the after-hours half.
  ending: {
    accent: '#818cf8', accent2: '#f472b6', onAccent: '#ffffff', font: 'var(--font-display)',
    wash: ['rgba(129, 140, 248, 0.38)', 'rgba(244, 114, 182, 0.22)', 'rgba(14, 13, 40, 0.80)'],
    jp: 'エンディング',
  },
  // Warm spotlight — somebody is performing.
  voice: {
    accent: '#ffc53d', accent2: '#ff6b6b', onAccent: '#2b1d02', font: 'var(--font-impact)',
    wash: ['rgba(255, 197, 61, 0.38)', 'rgba(255, 107, 107, 0.24)', 'rgba(46, 26, 3, 0.80)'],
    jp: 'ボイス',
  },
  // Waveform green: the one the machine actually measures.
  mimic: {
    accent: '#2fd47a', accent2: '#22d3ee', onAccent: '#03271a', font: 'var(--font-tech)',
    wash: ['rgba(47, 212, 122, 0.36)', 'rgba(34, 211, 238, 0.26)', 'rgba(3, 34, 24, 0.80)'],
    jp: 'ミミック',
  },
  // Atlas blues and parchment.
  geo: {
    accent: '#38bdf8', accent2: '#facc15', onAccent: '#031f2c', font: 'var(--font-tech)',
    wash: ['rgba(56, 189, 248, 0.36)', 'rgba(250, 204, 21, 0.18)', 'rgba(4, 28, 40, 0.80)'],
    jp: 'ワールド',
  },
  // The teal of the reference layout — out in the world, looking around.
  street: {
    accent: '#2dd4bf', accent2: '#a3e635', onAccent: '#03251f', font: 'var(--font-tech)',
    wash: ['rgba(45, 212, 191, 0.38)', 'rgba(163, 230, 53, 0.20)', 'rgba(3, 34, 32, 0.80)'],
    jp: 'ストリート',
  },
  // Orange, because the clock is running.
  rapid: {
    accent: '#fb923c', accent2: '#fbbf24', onAccent: '#2b1302', font: 'var(--font-impact)',
    wash: ['rgba(251, 146, 60, 0.40)', 'rgba(251, 191, 36, 0.26)', 'rgba(48, 21, 2, 0.80)'],
    jp: 'ラピッド',
  },
  // Gold that you can bank or lose.
  chain: {
    accent: '#facc15', accent2: '#f97316', onAccent: '#2b2102', font: 'var(--font-serif)',
    wash: ['rgba(250, 204, 21, 0.36)', 'rgba(249, 115, 22, 0.24)', 'rgba(38, 27, 2, 0.80)'],
    jp: 'チェーン',
  },
  // Cold and deliberate — four options, no hurry.
  mcq: {
    accent: '#60a5fa', accent2: '#34d399', onAccent: '#03203f', font: 'var(--font-display)',
    wash: ['rgba(96, 165, 250, 0.36)', 'rgba(52, 211, 153, 0.22)', 'rgba(6, 24, 48, 0.80)'],
    jp: 'ロック',
  },
  // Casino green and gold for the last hand.
  wager: {
    accent: '#facc15', accent2: '#22c55e', onAccent: '#2b2102', font: 'var(--font-serif)',
    wash: ['rgba(250, 204, 21, 0.34)', 'rgba(34, 197, 94, 0.24)', 'rgba(3, 32, 16, 0.80)'],
    jp: 'ウェイジャー',
  },
};

export const themeFor = (kind: RoundKind | null | undefined): Theme =>
  (kind && ROUND_THEME[kind]) || BASE_THEME;

/** The custom properties a themed container sets on itself. */
export function themeVars(theme: Theme): React.CSSProperties {
  return {
    ['--accent' as string]: theme.accent,
    ['--accent-2' as string]: theme.accent2,
    ['--on-accent' as string]: theme.onAccent,
    ['--round-font' as string]: theme.font,
    ['--wash-1' as string]: theme.wash[0],
    ['--wash-2' as string]: theme.wash[1],
    ['--wash-3' as string]: theme.wash[2],
  };
}

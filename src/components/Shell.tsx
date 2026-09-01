'use client';

/**
 * The chrome every screen wears.
 *
 * One anatomy, borrowed wholesale from the reference boards: a soft white
 * ground with colour blooming through it, a cut-out character standing in the
 * middle, a floating rail of circular buttons down the left edge, a thin top
 * bar with the katakana wordmark on one side and pale pills on the other, and
 * the screen's own content in frosted glass over the top.
 *
 * Screens compose these rather than reimplementing them, which is the only
 * reason the menu, the setup form, the arena and the Japanese duel all look
 * like the same product.
 */

import { useEffect, useState } from 'react';
import { HERO_SRC } from '@/game/art';

/* ------------------------------------------------------------------ icons

   Drawn rather than typed. Emoji are the obvious shortcut and they are the
   wrong one here: every platform draws them differently, several of these
   have no glyph at all on Windows, and the ones that do render arrive as
   full-colour pictures that fight the palette. These inherit `currentColor`,
   so a button can invert without the icon knowing.
*/

const ICONS = {
  home: <><path d="M3 10.2 12 3l9 7.2" /><path d="M5.6 8.6V20h12.8V8.6" /><path d="M9.8 20v-5.6h4.4V20" /></>,
  swords: <><path d="M14.5 14.5 20 20M20 20l1 -3-3 1" /><path d="M4 4h3l10 10-3 3L4 7Z" /><path d="M20 4h-3L13 8" /><path d="m7 17-3 3 3 1 -1-3Z" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" /></>,
  daily: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.4v2.3M12 19.3v2.3M21.6 12h-2.3M4.7 12H2.4M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6M18.8 18.8l-1.6-1.6M6.8 6.8 5.2 5.2" /></>,
  back: <><path d="M20 12H4.5" /><path d="M11 5.5 4.5 12l6.5 6.5" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  scissors: <><circle cx="6.5" cy="6.5" r="2.6" /><circle cx="6.5" cy="17.5" r="2.6" /><path d="M8.7 8.3 20 18M8.7 15.7 20 6" /></>,
  bulb: <><path d="M9.2 17.5h5.6" /><path d="M10 20.6h4" /><path d="M12 3.2a5.8 5.8 0 0 0-3.4 10.5c.6.5 1 1.2 1 2h4.8c0-.8.4-1.5 1-2A5.8 5.8 0 0 0 12 3.2Z" /></>,
  skip: <><path d="M5 5.5 14 12l-9 6.5V5.5Z" /><path d="M18.5 5.5v13" /></>,
  globe: <><circle cx="12" cy="12" r="8.6" /><path d="M3.4 12h17.2" /><path d="M12 3.4c2.2 2.4 3.4 5.4 3.4 8.6s-1.2 6.2-3.4 8.6c-2.2-2.4-3.4-5.4-3.4-8.6S9.8 5.8 12 3.4Z" /></>,
  trophy: <><path d="M7.5 4h9v5.2a4.5 4.5 0 0 1-9 0V4Z" /><path d="M16.5 5.4h3v1.4a3 3 0 0 1-3 3M7.5 5.4h-3v1.4a3 3 0 0 0 3 3" /><path d="M12 13.7V17M8.8 20h6.4M9.8 20v-1.4c0-.9.7-1.6 1.6-1.6h1.2c.9 0 1.6.7 1.6 1.6V20" /></>,
  mic: <><rect x="9" y="2.8" width="6" height="11" rx="3" /><path d="M5.4 11.4a6.6 6.6 0 0 0 13.2 0" /><path d="M12 18v3.2M8.8 21.2h6.4" /></>,
  map: <><path d="M9 4.4 3.4 6.6v13L9 17.4l6 2.2 5.6-2.2v-13L15 6.6 9 4.4Z" /><path d="M9 4.4v13M15 6.6v13" /></>,
  vol0: <><path d="M4 9.2h3.4L12 5v14l-4.6-4.2H4V9.2Z" /><path d="M16.5 9.5 21 14M21 9.5 16.5 14" /></>,
  vol1: <><path d="M4 9.2h3.4L12 5v14l-4.6-4.2H4V9.2Z" /></>,
  vol2: <><path d="M4 9.2h3.4L12 5v14l-4.6-4.2H4V9.2Z" /><path d="M15.8 9.6a3.4 3.4 0 0 1 0 4.8" /></>,
  vol3: <><path d="M4 9.2h3.4L12 5v14l-4.6-4.2H4V9.2Z" /><path d="M15.8 9.6a3.4 3.4 0 0 1 0 4.8" /><path d="M18.4 7a7 7 0 0 1 0 10" /></>,
} as const;

export type IconName = keyof typeof ICONS;

/** A line icon at the current text colour. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ screen */

export function Screen({
  hero = true, theme, children, className = '',
}: {
  /** Whether the cut-out figure stands in the middle of this screen. */
  hero?: boolean;
  /** Round colours, as custom properties. */
  theme?: React.CSSProperties;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`screen ${className}`} style={theme}>
      {/*
        The ground is not decoration. Frosted glass over a flat white page is
        just a white box — the blur has to have something to pick up, and
        these blooms are it. They also carry the round's colour, which is what
        makes the arena change channel from one round to the next.
      */}
      <div className="screen-ground" aria-hidden="true" />
      {hero && <HeroFigure />}
      <div className="screen-vignette" aria-hidden="true" />
      <div className="screen-body">{children}</div>
    </div>
  );
}

/**
 * The figure in the middle.
 *
 * Nothing is drawn until the file has actually loaded, so an empty slot leaves
 * no gap and no broken-image icon — the screen simply reads as clean glass
 * until a character PNG is dropped in at the path `HERO_SRC` names.
 */
function HeroFigure() {
  const [ok, setOk] = useState(false);

  // Probed rather than rendered-and-hidden: a hidden <img> that 404s still
  // logs a console error on every screen change, which is noise for the
  // whole game.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setOk(true);
    img.src = HERO_SRC;
    return () => { img.onload = null; };
  }, []);

  if (!ok) return null;
  return (
    <div className="screen-hero" aria-hidden="true">
      <img src={HERO_SRC} alt="" />
    </div>
  );
}

/* --------------------------------------------------------------------- hud */

export function Hud({ children }: { children?: React.ReactNode }) {
  return <header className="hud">{children}</header>;
}

export function Wordmark({ jp = 'クイズアリーナ', en = 'Quiz Arena' }: { jp?: string; en?: string }) {
  return (
    <span className="wordmark">
      <i className="wordmark-dot" />
      {jp}
      <span className="wordmark-en">{en}</span>
    </span>
  );
}

/* -------------------------------------------------------------------- rail */

export interface RailItem {
  key: string;
  /** A drawn icon, or a string for the few places a Japanese glyph is right. */
  icon: IconName | string;
  label: string;
  onGo?: () => void;
  disabled?: boolean;
}

export function Rail({ items, active, onPick }: {
  items: RailItem[];
  active?: string;
  onPick?: (key: string) => void;
}) {
  return (
    <nav className="rail" aria-label="Modes">
      {items.map((r) => (
        <button
          key={r.key}
          className="rail-btn"
          data-on={active === r.key}
          disabled={r.disabled}
          aria-label={r.label}
          aria-current={active === r.key ? 'page' : undefined}
          onClick={() => { onPick?.(r.key); r.onGo?.(); }}
        >
          {r.icon in ICONS
            ? <Icon name={r.icon as IconName} />
            : <span className="rail-glyph" aria-hidden="true">{r.icon}</span>}
          {/*
            The label is part of the button rather than a `title`: it shows on
            keyboard focus as well as hover, it is styled to match, and it
            arrives immediately instead of after the browser's tooltip delay.
            An icon-only rail is unreadable to anyone who has not learnt it.
          */}
          <span className="rail-label">{r.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ---------------------------------------------------------------- controls */

/**
 * The call to action: a wide pale pill with a filled circle on the end. Every
 * real "go" in the reference layouts is this shape, so every one here is too.
 */
export function Cta({
  children, sub, arrow = '↗', flip = false, className = '', ...rest
}: {
  children: React.ReactNode;
  /** Small second line under the label. */
  sub?: string;
  arrow?: string;
  /** Circle on the left instead of the right, for right-aligned cards. */
  flip?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const label = sub
    ? <span className="cta-label">{children}<small>{sub}</small></span>
    : <span>{children}</span>;
  return (
    <button
      {...rest}
      className={`cta ${className}`}
      style={flip ? { flexDirection: 'row-reverse', padding: '8px 26px 8px 8px', ...rest.style } : rest.style}
    >
      {label}
      <span className="cta-arrow" data-spin={arrow === '↗'}>{arrow}</span>
    </button>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { bindMediaElement } from '@/game/volume';

/* ------------------------------------------------------------------ timer */

export function TimerRing({ left, total }: { left: number; total: number }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const progress = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const low = left <= 5 && left > 0;
  return (
    <div className="timer-ring" data-low={low} aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 86 86">
        <circle className="timer-track" cx="43" cy="43" r={r} />
        <circle
          className="timer-fill"
          cx="43" cy="43" r={r}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <div className="timer-num tabular">{left}</div>
    </div>
  );
}

export function TimerBar({ left, total }: { left: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;
  return (
    <div className="timer-bar" data-low={left <= 5 && left > 0}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/* -------------------------------------------------------------- one-shots */

/** Full-screen colour wash + team name when someone buzzes. */
export function BuzzBanner({ name, colour, nonce }: { name: string; colour: string; nonce: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!nonce) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1100);
    return () => clearTimeout(t);
  }, [nonce]);
  if (!show) return null;
  return (
    <>
      <div className="buzz-flash" style={{ ['--c' as string]: colour }} />
      <div className="buzz-banner display" style={{ ['--c' as string]: colour }}>{name}</div>
    </>
  );
}

export function Verdict({ kind, nonce }: { kind: 'good' | 'bad' | null; nonce: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!nonce || !kind) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 900);
    return () => clearTimeout(t);
  }, [nonce, kind]);
  if (!show || !kind) return null;
  return (
    <div className="verdict" data-kind={kind}>
      <div className="verdict-mark display">{kind === 'good' ? '✓' : '✗'}</div>
    </div>
  );
}

export function Confetti({ nonce, colours }: { nonce: number; colours: string[] }) {
  const [pieces, setPieces] = useState<{ id: number; style: React.CSSProperties }[]>([]);
  useEffect(() => {
    if (!nonce) return;
    const made = Array.from({ length: 90 }, (_, i) => ({
      id: nonce * 1000 + i,
      style: {
        left: `${Math.random() * 100}%`,
        background: colours[i % colours.length],
        animationDuration: `${1.8 + Math.random() * 2}s`,
        animationDelay: `${Math.random() * 0.7}s`,
        transform: `rotate(${Math.random() * 360}deg)`,
      } as React.CSSProperties,
    }));
    setPieces(made);
    const t = setTimeout(() => setPieces([]), 5000);
    return () => clearTimeout(t);
  }, [nonce, colours]);
  if (!pieces.length) return null;
  return <div className="confetti">{pieces.map((p) => <i key={p.id} style={p.style} />)}</div>;
}

export function Toast({ toast }: { toast: { text: string; nonce: number } | null }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    setText(toast.text);
    const t = setTimeout(() => setText(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  if (!text) return null;
  return <div className="toast">{text}</div>;
}

/* ---------------------------------------------------------------- media */

/**
 * Progressive image reveal. Blur and zoom ease off as the clock runs down, so a
 * picture starts as an unreadable smear and resolves into the answer.
 */
export function RevealImage({
  src, progress, sprite, mode = 'blur', frame = 'portrait',
}: {
  src: string;
  /** 0 = fully hidden, 1 = fully revealed. */
  progress: number;
  sprite?: boolean;
  mode?: 'blur' | 'silhouette' | 'none';
  frame?: 'portrait' | 'wide' | 'square';
}) {
  const p = Math.max(0, Math.min(1, progress));
  const hidden = mode !== 'none' && p < 1;
  const style =
    mode === 'blur'
      ? ({ ['--blur' as string]: `${(1 - p) * 30}px`, ['--zoom' as string]: `${1 + (1 - p) * 0.5}` })
      : undefined;

  return (
    <div className={`media-frame ${frame === 'wide' ? 'wide' : frame === 'square' ? 'square' : ''}`}>
      <img
        src={src}
        alt=""
        className={[
          'media-img',
          sprite ? 'sprite' : '',
          hidden && mode === 'blur' ? 'hidden-blur' : '',
          hidden && mode === 'silhouette' ? 'silhouette' : '',
        ].join(' ')}
        style={style}
        loading="eager"
      />
    </div>
  );
}

/* -------------------------------------------------------------- audio */

/**
 * Plays an anime opening. Mounted as a hidden <video> so it can take either an
 * audio-only file or the source video, with an equaliser shown instead of the
 * picture (which would give the answer away).
 *
 * Two sources are offered, smallest first, and the browser plays the first one
 * it understands. That matters more than it sounds: the audio-only file is
 * around a ninth the size of the video, but it is Ogg Vorbis, which Safari will
 * not play — listing both means most browsers get the small file and Safari
 * still gets a round.
 */
export function OpeningPlayer({
  src, fallback, nextSrc, nextFallback, playing, onEnded, startAt = 0,
}: {
  src: string;
  fallback?: string;
  /** The track after this one, warmed in the background while this one plays. */
  nextSrc?: string;
  nextFallback?: string;
  playing: boolean;
  onEnded?: () => void;
  startAt?: number;
}) {
  const els = useRef(new Map<string, HTMLVideoElement>());
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { setFailed(false); setProgress(0); setReady(false); }, [src]);

  // The theme streams through a media element rather than the audio graph, so
  // it takes its level from the volume control directly.
  useEffect(() => {
    const el = els.current.get(src);
    return el ? bindMediaElement(el) : undefined;
  }, [src]);

  useEffect(() => {
    const el = els.current.get(src);
    if (!el) return;
    if (playing) {
      // Openings often have a quiet intro; skipping in lands on the hook.
      if (startAt && el.currentTime < startAt) el.currentTime = startAt;
      void el.play().catch(() => setFailed(true));
    } else {
      el.pause();
    }
  }, [playing, startAt, src]);

  // Each track gets its own element, keyed by URL. React keeps an element alive
  // for as long as its key stays in this list, so the one that spent the last
  // question downloading is the very same one that plays next — which is the
  // only prefetch that works here, because AnimeThemes serves these `no-cache`
  // and the browser will not reuse a downloaded body across elements.
  //
  // Keying by URL is also what makes it safe: an element can only ever hold the
  // track it was created for, so no amount of skipping can play the wrong song.
  const tracks: { url: string; alt?: string; current: boolean }[] = [
    { url: src, alt: fallback, current: true },
  ];
  // Only once this track is comfortable — a second download competing with the
  // one the room is waiting on would make the problem worse, not better.
  if (nextSrc && nextSrc !== src && ready) {
    tracks.push({ url: nextSrc, alt: nextFallback, current: false });
  }

  return (
    <div className="audio-stage">
      {tracks.map((t) => (
        <video
          key={t.url}
          ref={(el) => {
            if (el) els.current.set(t.url, el);
            else els.current.delete(t.url);
          }}
          playsInline
          preload="auto"
          muted={!t.current}
          style={{ display: 'none' }}
          onCanPlayThrough={t.current ? () => setReady(true) : undefined}
          onTimeUpdate={t.current ? (e) => {
            const el = e.currentTarget;
            if (el.duration) setProgress(el.currentTime / el.duration);
          } : undefined}
          onEnded={t.current ? onEnded : undefined}
          onError={t.current ? () => setFailed(true) : undefined}
        >
          <source src={t.url} type={t.url.endsWith('.ogg') ? 'audio/ogg' : 'video/webm'} />
          {t.alt && <source src={t.alt} type="video/webm" />}
        </video>
      ))}
      <div className="viz" data-playing={playing && !failed}>
        {Array.from({ length: 26 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${(i % 9) * 0.11}s` }} />
        ))}
      </div>
      <div className="audio-progress"><i style={{ width: `${progress * 100}%` }} /></div>
      <p className="muted" style={{ marginTop: 14, fontSize: '0.88em' }}>
        {failed
          ? 'This track would not load — skip to the next one.'
          : playing ? 'Listening…' : 'Paused'}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- misc */

export function ScoreNumber({ value, bump, colour }: { value: number; bump: number; colour: string }) {
  const [cls, setCls] = useState('');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setCls('score-bump');
    const t = setTimeout(() => setCls(''), 520);
    return () => clearTimeout(t);
  }, [bump]);
  return <div className={`team-score ${cls}`} style={{ ['--c' as string]: colour }}>{value}</div>;
}

'use client';

/**
 * The volume control, pinned in the corner of every screen.
 *
 * A party game gets turned down mid-round — someone is talking, the openings
 * round is louder than the buzzers — so this stays reachable at all times
 * rather than living in a settings screen you would have to quit a game to
 * reach. The setting is saved, so the room's level survives a reload.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bumpVolume, getVolume, setVolume, subscribeVolume, toggleMute, type VolumeState,
} from '@/game/volume';

const icon = (v: VolumeState) => {
  if (v.muted || v.master === 0) return '🔇';
  if (v.master < 0.34) return '🔈';
  if (v.master < 0.7) return '🔉';
  return '🔊';
};

export default function VolumeControl({ shifted = false }: { shifted?: boolean }) {
  // Starts from the module defaults and syncs on mount: reading localStorage
  // during render would disagree with the server-rendered markup.
  const [vol, setVol] = useState<VolumeState>({ master: 0.8, effects: 0.7, muted: false });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVol({ ...getVolume() });
    return subscribeVolume(() => setVol({ ...getVolume() }));
  }, []);

  // Click-away and Escape, so the panel never gets stranded over the game.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // M mutes, [ and ] step the level. None of these collide with the host
  // controls (A/L to buzz, Y/N, H, space, enter) or the answer keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
      if (e.key === '[') { bumpVolume(-0.1); return; }
      if (e.key === ']') { bumpVolume(0.1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pct = useCallback((v: number) => `${Math.round(v * 100)}%`, []);

  return (
    <div className="volume" data-shifted={shifted} ref={wrapRef}>
      <button
        className="volume-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Volume ${vol.muted ? 'muted' : pct(vol.master)}`}
        aria-expanded={open}
        title="Volume (M to mute)"
      >
        {icon(vol)}
      </button>

      {open && (
        <div className="volume-panel" role="group" aria-label="Volume">
          <div className="volume-row">
            <span className="label">Volume</span>
            <span className="volume-value tabular">{vol.muted ? 'Muted' : pct(vol.master)}</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={vol.muted ? 0 : vol.master}
            aria-label="Master volume"
            onChange={(e) => setVolume({ master: Number(e.target.value) })}
          />

          <div className="volume-row" style={{ marginTop: 12 }}>
            <span className="label">Beeps &amp; buzzers</span>
            <span className="volume-value tabular">{pct(vol.effects)}</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={vol.effects}
            aria-label="Effects volume"
            onChange={(e) => setVolume({ effects: Number(e.target.value) })}
          />
          <p className="dim volume-hint">
            Turn these down to keep the ticks out of the way of the music.
          </p>

          <button className="btn btn-sm volume-mute" onClick={toggleMute}>
            {vol.muted ? '🔊 Unmute' : '🔇 Mute everything'}
          </button>
          <p className="dim volume-hint">
            <b>M</b> mutes · <b>[</b> and <b>]</b> step the level
          </p>
        </div>
      )}
    </div>
  );
}

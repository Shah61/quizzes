'use client';

/**
 * The sound control, pinned in the corner of every screen.
 *
 * A party game gets turned down mid-round — someone is talking, the openings
 * round is louder than the buzzers — so this stays reachable at all times
 * rather than living in a settings screen you would have to quit a game to
 * reach. The setting is saved, so the room's level survives a reload.
 *
 * It wears its level on its face rather than hiding behind a speaker glyph: in
 * a room where everyone can see the screen, "is it muted or is the track just
 * quiet?" is a question the control should already have answered.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bumpVolume, getVolume, setVolume, subscribeVolume, toggleMute, type VolumeState,
} from '@/game/volume';
import { Icon, type IconName } from './Shell';

/** Four steps, so the icon says roughly how loud it is before you read it. */
const iconFor = (v: VolumeState): IconName => {
  if (v.muted || v.master === 0) return 'vol0';
  if (v.master < 0.34) return 'vol1';
  if (v.master < 0.7) return 'vol2';
  return 'vol3';
};

export default function VolumeControl() {
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
  const reading = vol.muted ? 'Muted' : pct(vol.master);

  return (
    <div className="corner-controls" ref={wrapRef}>
      <div className="volume">
        <button
          className="icon-btn volume-btn"
          data-muted={vol.muted || vol.master === 0}
          onClick={() => setOpen((o) => !o)}
          aria-label={`Sound — ${reading}. Open the sound settings.`}
          aria-expanded={open}
        >
          <Icon name={iconFor(vol)} size={19} />
          <span className="volume-level" aria-hidden="true">{reading}</span>
          {!open && <span className="corner-label">Sound &amp; volume · press M to mute</span>}
        </button>

        {open && (
          <div className="volume-panel" role="group" aria-label="Sound settings">
            <div className="volume-row">
              <span className="label">Everything</span>
              <span className="volume-value">{vol.muted ? 'Muted' : pct(vol.master)}</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01}
              value={vol.muted ? 0 : vol.master}
              aria-label="Overall volume"
              onChange={(e) => setVolume({ master: Number(e.target.value) })}
            />

            <div className="volume-row">
              <span className="label">Beeps &amp; buzzers</span>
              <span className="volume-value">{pct(vol.effects)}</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01}
              value={vol.effects}
              aria-label="Effects volume"
              onChange={(e) => setVolume({ effects: Number(e.target.value) })}
            />
            <p className="volume-hint">
              Turn these down to keep the ticks and buzzers out of the way of the music.
            </p>

            <button className="btn btn-primary volume-mute" onClick={toggleMute}>
              <Icon name={vol.muted ? 'vol3' : 'vol0'} size={17} />
              {vol.muted ? 'Unmute' : 'Mute everything'}
            </button>
            <p className="volume-hint">
              <b>M</b> mutes · <b>[</b> and <b>]</b> step the level
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

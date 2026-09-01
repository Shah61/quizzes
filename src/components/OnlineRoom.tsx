'use client';

import { useEffect, useRef, useState } from 'react';
import type { TeamId } from '@/game/types';
import { useGameHost, type TeamBrief } from '@/net/buzzers';
import type { Snapshot } from '@/net/protocol';

/**
 * Host-side control for online play. Opens a room, shows the code and join
 * link, lists who is connected, and pushes every state change out to their
 * devices. Playing on one shared screen works whether or not this is used.
 */
export default function OnlineRoom({
  teams, snapshot, onAction,
}: {
  teams: Record<TeamId, TeamBrief>;
  snapshot: Snapshot;
  onAction: (team: TeamId, action: { type: 'buzz' } | { type: 'lock'; choice: string } | { type: 'vote'; team: TeamId }, playerName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { status, code, players, open: openRoom, close, broadcast } = useGameHost(teams, onAction);

  // Only send when something actually changed — the clock ticks once a second
  // and every tick would otherwise be a full broadcast to every device.
  const lastSent = useRef('');
  useEffect(() => {
    if (status !== 'open') return;
    const encoded = JSON.stringify(snapshot);
    if (encoded === lastSent.current) return;
    lastSent.current = encoded;
    broadcast(snapshot);
  }, [snapshot, status, broadcast]);

  const joinUrl = typeof window !== 'undefined' && code
    ? `${window.location.origin}/play?room=${code}`
    : '';

  if (!open) {
    return (
      <button
        className="phone-chip"
        data-live={status === 'open'}
        onClick={() => { setOpen(true); if (status === 'idle') void openRoom(); }}
        aria-label={status === 'open' && code ? `Online room ${code}` : 'Play online'}
        title={status === 'open' && code
          ? `Room ${code} — ${players.length} on their own device${players.length === 1 ? '' : 's'}`
          : 'Let friends play from their own devices'}
      >
        🌐
        {players.length > 0 && <span className="phone-count">{players.length}</span>}
      </button>
    );
  }

  return (
    <div className="phone-panel">
      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Online room</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Hide</button>
      </div>

      {status === 'connecting' && <p className="muted" style={{ fontSize: '0.9em' }}>Opening room…</p>}

      {status === 'error' && (
        <p style={{ color: 'var(--bad)', fontSize: '0.86em' }}>
          Could not open a room. You can still play on this screen — <span className="kbd">A</span>{' '}
          and <span className="kbd">L</span> are the buzzers.
        </p>
      )}

      {status === 'open' && code && (
        <>
          <div className="phone-code">{code}</div>
          <p className="card-note" style={{ fontSize: '0.82em' }}>
            Friends open <b style={{ color: 'var(--ink)' }}>{joinUrl.replace(/^https?:\/\//, '')}</b>{' '}
            and everything appears on their own screen.
          </p>
          <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(joinUrl)}>
            Copy join link
          </button>

          <div className="stack gap-xs" style={{ marginTop: 2 }}>
            <span className="eyebrow">In the room · {players.length}</span>
            {players.length === 0
              ? <p className="dim" style={{ fontSize: '0.82em' }}>Nobody has joined yet.</p>
              : players.map((p) => (
                <div key={p.id} className="row gap-xs" style={{ fontSize: '0.86em' }}>
                  <span className="team-dot" style={{ ['--c' as string]: teams[p.team].colour, width: 8, height: 8 }} />
                  <span className="grow">{p.name}</span>
                  <span className="dim">{teams[p.team].name}</span>
                </div>
              ))}
          </div>

          <button className="btn btn-ghost btn-sm" onClick={close}>Close room</button>
        </>
      )}
    </div>
  );
}

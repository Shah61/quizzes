'use client';

/**
 * Where in the World / Street View — the map rounds.
 *
 * Two layouts from one component, because the interaction is identical and only
 * the clue differs:
 *
 *   Street View — the panorama fills the screen and the map is a small inset in
 *     the corner that grows when you reach for it. Stacking the two vertically
 *     meant scrolling away from the picture to place a pin and back again to
 *     check, which is no way to play.
 *   Where in the World — no panorama, so the map is the whole point and gets
 *     the room.
 *
 * A pin is placed, then confirmed. Guessing on a single click made every
 * misclick final, and on a map this small a misclick is a thousand kilometres.
 * Nothing is drawn for anyone else until every team is in.
 */

import { useCallback, useMemo, useState } from 'react';
import type { Question, TeamId } from '@/game/types';
import { describeDistance, distanceKm, scoreGuess, type LatLng } from '@/game/geo';
import { sfx } from '@/game/sfx';
import WorldMap, { type Pin } from './WorldMap';
import StreetView from './StreetView';

export default function GeoRound({
  question, teams, teamNames, teamColours, points, onFinish,
}: {
  question: Question;
  teams: TeamId[];
  teamNames: Record<TeamId, string>;
  teamColours: Record<TeamId, string>;
  points: number;
  onFinish: (points: Partial<Record<TeamId, number>>) => void;
}) {
  const [guesses, setGuesses] = useState<Partial<Record<TeamId, LatLng>>>({});
  const [pending, setPending] = useState<LatLng | null>(null);
  const [done, setDone] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const target = question.geo;
  const pano = Boolean(target?.pano);
  const upNow = teams.find((t) => !guesses[t]) ?? null;

  const results = useMemo(() => {
    if (!target) return [];
    return teams
      .map((t) => {
        const at = guesses[t];
        const km = at ? distanceKm(at, target) : Infinity;
        return { team: t, at, km, score: at ? scoreGuess(at, target, points) : 0 };
      })
      .sort((a, b) => a.km - b.km);
  }, [guesses, target, teams, points]);

  const confirm = useCallback(() => {
    if (!upNow || !pending || done) return;
    sfx.select();
    const next = { ...guesses, [upNow]: pending };
    setGuesses(next);
    setPending(null);
    if (teams.every((t) => next[t])) { setDone(true); sfx.reveal(); }
    else setMapOpen(false); // hand the screen over without the next team seeing
  }, [upNow, pending, done, guesses, teams]);

  if (!target) return null;

  // The pending pin is only ever shown to the team placing it.
  const pins: Pin[] = done
    ? [
      { at: target, colour: '#ffc53d', kind: 'target', label: target.name },
      ...teams.filter((t) => guesses[t]).map((t) => ({
        at: guesses[t]!, colour: teamColours[t], kind: 'guess' as const, label: teamNames[t],
      })),
    ]
    : pending && upNow
      ? [{ at: pending, colour: teamColours[upNow], kind: 'guess' as const }]
      : [];

  const lines = done
    ? teams.filter((t) => guesses[t]).map((t) => ({ from: guesses[t]!, to: target as LatLng, colour: teamColours[t] }))
    : [];

  const theMap = (
    <WorldMap pins={pins} lines={lines} onPick={done ? undefined : setPending} disabled={done} />
  );

  const turnLine = !done && upNow && (
    <p className="geo-turn" style={{ ['--c' as string]: teamColours[upNow] }}>
      {teams.length === 1 ? 'Drop a pin' : `${teamNames[upNow]} — drop a pin`}
    </p>
  );

  const confirmButton = !done && (
    <button className="btn btn-primary geo-confirm" disabled={!pending} onClick={confirm}>
      {pending ? 'Lock in this guess' : 'Click the map first'}
    </button>
  );

  const resultsPanel = done && (
    <div className="geo-results">
      {results.map((r, i) => (
        <div key={r.team} className="geo-result" style={{ ['--c' as string]: teamColours[r.team] }}>
          <span className="geo-result-team">
            {i === 0 && teams.length > 1 ? '🏆 ' : ''}{teamNames[r.team]}
          </span>
          <span className="geo-result-km tabular">{Math.round(r.km).toLocaleString()} km</span>
          <span className="geo-result-note muted">{describeDistance(r.km)}</span>
          <span className="geo-result-score">+{r.score}</span>
        </div>
      ))}
    </div>
  );

  /* ------------------------------------------------- street view layout */

  if (pano) {
    return (
      <div className="geo-stage">
        <StreetView
          view={{ lat: target.lat, lng: target.lng, heading: target.heading ?? 0 }}
          label="Where are you?"
        />

        {!done && (
          <div className="geo-inset" data-open={mapOpen}>
            <button
              className="geo-inset-toggle"
              aria-expanded={mapOpen}
              onClick={() => setMapOpen((o) => !o)}
            >
              {mapOpen ? '▾ Hide map' : '🗺️ Open the map'}
            </button>
            <div className="geo-inset-body">
              {theMap}
              <div className="geo-inset-actions">
                {turnLine}
                {confirmButton}
              </div>
            </div>
          </div>
        )}

        {done && (
          <div className="geo-reveal">
            <span className="eyebrow">You were in</span>
            <h2 className="geo-name">{target.name}</h2>
            <div className="geo-reveal-map">{theMap}</div>
            {resultsPanel}
            <button className="btn btn-primary btn-lg" onClick={() => onFinish(Object.fromEntries(results.map((r) => [r.team, r.score])))}>
              Next place →
            </button>
          </div>
        )}

        {!done && (
          <div className="geo-corner-actions">
            {/*
              Until the locations have been checked against Street View there
              will be the odd spot Google has never photographed, and the player
              is left staring at a black frame with no idea whether it is broken
              or just dark. Say so, and let them move on.
            */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onFinish(Object.fromEntries(teams.map((t) => [t, 0])))}
              title="No panorama here — move to the next place"
            >
              ⚫ Nothing loaded — skip
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDone(true)}>
              Give up — show me
            </button>
          </div>
        )}
      </div>
    );
  }

  /* --------------------------------------------- flag / country layout */

  return (
    <div className="stack gap center" style={{ width: '100%' }}>
      <div className="geo-brief">
        <span className="eyebrow">Where in the world is</span>
        <div className="row gap-sm" style={{ justifyContent: 'center', alignItems: 'center' }}>
          {target.flag && <img src={target.flag} alt="" className="geo-flag" />}
          <h2 className="geo-name">{target.name}</h2>
        </div>
        {target.capital && <p className="muted">Capital: {target.capital}</p>}
      </div>

      {turnLine}
      {theMap}
      {confirmButton}
      {resultsPanel}

      {done ? (
        <button className="btn btn-primary btn-lg" onClick={() => onFinish(Object.fromEntries(results.map((r) => [r.team, r.score])))}>
          Next place →
        </button>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={() => setDone(true)}>Give up — show me</button>
      )}
    </div>
  );
}

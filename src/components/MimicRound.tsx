'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TeamId } from '@/game/types';
import { extractFeatures, scoreTake, type Features, type MimicScore } from '@/game/mimic-dsp';
import {
  ANALYSIS_RATE, decodeBlob, playBuffer, playTake, resolveRef, toAnalysisSamples,
  SABOTAGE_INFO, type Sabotage,
} from '@/game/mimic-audio';
import type { MimicRef } from '@/game/mimic-refs';
import { canRecord, NO_MIC, useRecorder } from '@/game/recorder';
import { sfx } from '@/game/sfx';

type Phase = 'loading' | 'failed' | 'intro' | 'listening' | 'countdown' | 'recording' | 'scoring' | 'results' | 'wheel';

interface Result { score: MimicScore; buffer: AudioBuffer | null }

const WHEEL: { sabotage: Exclude<Sabotage, null>; weight: number }[] = [
  { sabotage: 'echo', weight: 1 }, { sabotage: 'pitch', weight: 1 },
  { sabotage: 'saturate', weight: 1 }, { sabotage: 'chop', weight: 1 },
  { sabotage: 'fart', weight: 1 },
];

/**
 * The Mimic round: everyone hears the same sound, gets one shot at copying it,
 * and the takes are graded on melody and rhythm rather than on whose voice it
 * is. Between rounds the wheel hands out a sabotage to aim at somebody.
 *
 * The reference may be a synthesised recipe, a scene clip, an anime opening or
 * something cut in the Clip Studio — resolveRef() flattens all of those to one
 * AudioBuffer, so from here down there is only one kind of round.
 */
export default function MimicRound({
  reference, teams, teamNames, teamColours, sabotages, onFinish,
}: {
  reference: MimicRef;
  /** Who is taking a shot at this one. A solo run has a single entry. */
  teams: TeamId[];
  teamNames: Record<TeamId, string>;
  teamColours: Record<TeamId, string>;
  /** Sabotage aimed at each team for this round, from the previous wheel. */
  sabotages: Partial<Record<TeamId, Sabotage>>;
  onFinish: (winner: TeamId | null, scores: Record<TeamId, number>, nextSabotage: { team: TeamId; sabotage: Sabotage } | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [turn, setTurn] = useState<TeamId>(teams[0] ?? 'a');
  const [count, setCount] = useState(3);
  const [results, setResults] = useState<Partial<Record<TeamId, Result>>>({});
  const [nowPlaying, setNowPlaying] = useState<TeamId | null>(null);
  const [spun, setSpun] = useState<{ team: TeamId; sabotage: Sabotage } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [refSeconds, setRefSeconds] = useState(2);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refBufferRef = useRef<AudioBuffer | null>(null);
  const refFeaturesRef = useRef<Features | null>(null);
  const { start, stop, recording, error } = useRecorder();
  const recordable = canRecord();

  // Enough room to answer a long clip, with a moment's grace on the end.
  const takeSeconds = Math.min(8, refSeconds + 0.9);

  /* ---------------------------------------------- resolve the reference */

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setLoadError(null);
    setTurn(teams[0] ?? 'a');
    setResults({});
    setSpun(null);
    (async () => {
      try {
        const buf = await resolveRef(reference);
        if (cancelled) return;
        refBufferRef.current = buf;
        setRefSeconds(buf.duration);
        // Features come from the same buffer everyone hears, so every device
        // grades against exactly the same reference.
        refFeaturesRef.current = extractFeatures(toAnalysisSamples(buf), ANALYSIS_RATE);
        setPhase('intro');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'That sound could not be loaded.');
        setPhase('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [reference]);

  const playReference = useCallback(async () => {
    if (!refBufferRef.current) return;
    setPhase('listening');
    await playBuffer(refBufferRef.current);
    setPhase('intro');
  }, []);

  /* ----------------------------------------------------- record and score */

  const runTake = useCallback(async (team: TeamId) => {
    setPhase('countdown');
    for (let n = 3; n >= 1; n--) {
      setCount(n);
      sfx.tick();
      await new Promise((r) => setTimeout(r, 700));
    }
    setPhase('recording');
    sfx.select();

    const takePromise = start();
    // One shot, fixed length: no retries and no editing, same as the reference.
    const timer = setTimeout(() => stop(), takeSeconds * 1000);
    const take = await takePromise;
    clearTimeout(timer);

    // The microphone never opened, so there is no take to grade — go back
    // rather than writing a zero the team did not earn.
    if (take === NO_MIC) { setPhase('intro'); return; }

    setPhase('scoring');
    let result: Result = { score: { melody: 0, rhythm: 0, effort: 0, total: 0 }, buffer: null };
    if (take && refFeaturesRef.current) {
      const buffer = await decodeBlob(take.blob);
      if (buffer) {
        const feats = extractFeatures(toAnalysisSamples(buffer), ANALYSIS_RATE);
        result = { score: scoreTake(refFeaturesRef.current, feats), buffer };
      }
    }
    setResults((prev) => ({ ...prev, [team]: result }));

    // Hand over to the next team that has not been up yet; when there is none
    // left — which in a solo run is immediately — go to the scores.
    const next = teams[teams.indexOf(team) + 1];
    if (next) { setTurn(next); setPhase('intro'); }
    else { setPhase('results'); sfx.reveal(); }
  }, [start, stop, takeSeconds, teams]);

  /* ---------------------------------------------------------- playback */

  const hear = useCallback(async (team: TeamId) => {
    const res = results[team];
    if (!res?.buffer) return;
    setNowPlaying(team);
    await playTake(res.buffer, sabotages[team] ?? null);
    setNowPlaying(null);
  }, [results, sabotages]);

  /* ------------------------------------------------------------- wheel */

  const spin = useCallback(async () => {
    setSpinning(true);
    setPhase('wheel');
    // A short shuffle before it settles, so the wheel feels like it spun.
    for (let i = 0; i < 10; i++) {
      const s = WHEEL[Math.floor(Math.random() * WHEEL.length)].sabotage;
      // Only ever lands on somebody who is actually playing.
      setSpun({ team: teams[Math.floor(Math.random() * teams.length)], sabotage: s });
      sfx.tick();
      await new Promise((r) => setTimeout(r, 90 + i * 22));
    }
    sfx.bank();
    setSpinning(false);
  }, [teams]);

  const scoreA = results.a?.score.total ?? 0;
  const scoreB = results.b?.score.total ?? 0;
  // Alone there is nobody to beat, so the take always takes the round's points.
  const solo = teams.length === 1;
  const winner: TeamId | null = solo ? teams[0]
    : scoreA === scoreB ? null : scoreA > scoreB ? 'a' : 'b';

  /* -------------------------------------------------------------- views */

  const soundCard = (
    <div className="mimic-card">
      <span className="eyebrow">Copy this sound</span>
      <div className="mimic-emoji">{reference.emoji}</div>
      <h2 className="display mimic-name">{reference.name}</h2>
      {reference.from && <p className="muted mimic-from">{reference.from}</p>}
      <p className="muted" style={{ fontSize: '0.9em' }}>
        {takeSeconds.toFixed(1)}s · one shot, no retries
      </p>
    </div>
  );

  if (phase === 'loading') {
    return (
      <div className="stack gap center">
        {soundCard}
        <p className="muted">Loading the sound…</p>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="stack gap center">
        {soundCard}
        <p style={{ color: 'var(--bad)', fontSize: '0.9em', maxWidth: '46ch', textAlign: 'center' }}>
          {loadError}
        </p>
        <button className="btn btn-primary" onClick={() => onFinish(null, { a: 0, b: 0 }, null)}>
          Skip this one →
        </button>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className="stack gap center">
        {soundCard}
        <p className="eyebrow" style={{ color: teamColours[turn] }}>{teamNames[turn]} — get ready</p>
        <div className="mimic-count display">{count}</div>
      </div>
    );
  }

  if (phase === 'recording') {
    return (
      <div className="stack gap center">
        {soundCard}
        <div className="mimic-live" style={{ ['--c' as string]: teamColours[turn] }}>
          <span className="mimic-dot" />
          {teamNames[turn]} — GO!
        </div>
        <button className="btn btn-bad" onClick={stop}>Stop early</button>
      </div>
    );
  }

  if (phase === 'scoring') {
    return (
      <div className="stack gap center">
        {soundCard}
        <p className="muted">Scoring the take…</p>
      </div>
    );
  }

  if (phase === 'results' || phase === 'wheel') {
    return (
      <div className="stack gap center" style={{ width: 'min(94vw, 780px)' }}>
        <div className="row gap-sm" style={{ justifyContent: 'center' }}>
          <span className="category-badge">{reference.emoji} {reference.name}</span>
          <button className="btn btn-sm" onClick={playReference}>▶ Hear it again</button>
        </div>

        <div className="mimic-scores">
          {teams.map((team) => {
            const res = results[team];
            const sab = sabotages[team];
            return (
              <div key={team} className="mimic-score-card" data-win={winner === team}
                style={{ ['--c' as string]: teamColours[team] }}>
                <span className="voice-team">{teamNames[team]}</span>
                <div className="mimic-total display">{res?.score.total ?? 0}</div>
                <div className="mimic-bars">
                  <Bar label="melody" value={res?.score.melody ?? 0} />
                  <Bar label="rhythm" value={res?.score.rhythm ?? 0} />
                </div>
                {sab && (
                  <span className="mimic-sabotaged">
                    {SABOTAGE_INFO[sab].emoji} {SABOTAGE_INFO[sab].name}
                  </span>
                )}
                <button className="btn btn-sm" disabled={!res?.buffer || nowPlaying !== null}
                  onClick={() => hear(team)}>
                  {nowPlaying === team ? '♪ Playing…' : '▶ Hear their take'}
                </button>
              </div>
            );
          })}
        </div>

        {phase === 'wheel' && spun && (
          <div className="mimic-wheel">
            <span className="eyebrow">{spinning ? 'Spinning…' : 'The wheel says'}</span>
            <div className="mimic-wheel-face">{spun.sabotage ? SABOTAGE_INFO[spun.sabotage].emoji : '—'}</div>
            <p className="mimic-wheel-text">
              <b style={{ color: teamColours[spun.team] }}>{teamNames[spun.team]}</b>
              {' — '}
              {spun.sabotage ? SABOTAGE_INFO[spun.sabotage].blurb : 'gets away with it'}
            </p>
          </div>
        )}

        <div className="row gap-sm wrap-w" style={{ justifyContent: 'center' }}>
          {phase === 'results' && (
            <button className="btn btn-gold" onClick={spin}>🎡 Spin the wheel</button>
          )}
          <button className="btn btn-primary" disabled={spinning}
            onClick={() => onFinish(winner, { a: scoreA, b: scoreB }, spun)}>
            Next sound →
          </button>
        </div>
      </div>
    );
  }

  // intro
  return (
    <div className="stack gap center">
      {soundCard}

      {!recordable && (
        <p className="muted" style={{ fontSize: '0.88em', maxWidth: '44ch', textAlign: 'center' }}>
          Recording needs microphone access on a secure connection. On the deployed
          site this works; over plain http it will not.
        </p>
      )}
      {error && <p style={{ color: 'var(--bad)', fontSize: '0.88em', maxWidth: '44ch' }}>{error}</p>}

      <div className="row gap-sm wrap-w" style={{ justifyContent: 'center' }}>
        <button className="btn btn-lg" onClick={playReference} disabled={phase === 'listening'}>
          {phase === 'listening' ? '♪ Listen…' : '▶ Play the sound'}
        </button>
        <button className="btn btn-primary btn-lg" disabled={!recordable || recording || phase === 'listening'}
          style={{ borderColor: teamColours[turn] }}
          onClick={() => runTake(turn)}>
          🎤 {teamNames[turn]} — take your shot
        </button>
      </div>

      <p className="dim" style={{ fontSize: '0.85em' }}>
        {solo ? 'One shot — make it count'
          : turn === 'a' ? 'Team A goes first'
          : `${teamNames.a} scored ${scoreA}. ${teamNames.b} is up.`}
      </p>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mimic-bar">
      <span className="mimic-bar-label">{label}</span>
      <div className="mimic-bar-track"><i style={{ width: `${value}%` }} /></div>
      <span className="mimic-bar-value tabular">{value}</span>
    </div>
  );
}

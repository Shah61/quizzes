'use client';

import { useEffect, useRef, useState } from 'react';
import type { Question, TeamId } from '@/game/types';
import { canRecord, NO_MIC, useRecorder, type Take } from '@/game/recorder';
import { sfx } from '@/game/sfx';
import { bindMediaElement } from '@/game/volume';

const MAX_SECONDS = 20;

/**
 * Voice Battle.
 *
 * Both teams perform the same character, optionally recording it so everyone
 * can hear the takes back. Nothing here decides who was better — that is a
 * vote, because it is a matter of taste. The stats under each take are
 * loudness figures for flavour, not a score.
 */
export default function VoiceRound({
  question, teamNames, teamColours, votes, onWinner, onSkip,
}: {
  question: Question;
  teamNames: Record<TeamId, string>;
  teamColours: Record<TeamId, string>;
  /** Live tally from players voting on their own devices. */
  votes: Record<TeamId, number>;
  onWinner: (team: TeamId | null) => void;
  onSkip: () => void;
}) {
  const [takes, setTakes] = useState<Partial<Record<TeamId, Take>>>({});
  const [target, setTarget] = useState<TeamId | null>(null);
  const [playing, setPlaying] = useState<TeamId | null>(null);
  const { start, stop, recording, elapsed, error } = useRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordable = canRecord();

  const voice = question.voice;

  // A new prompt means fresh takes; release the old object URLs.
  useEffect(() => {
    return () => { Object.values(takes).forEach((t) => t && URL.revokeObjectURL(t.url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  // Hard stop so a team cannot monologue forever.
  useEffect(() => {
    if (recording && elapsed >= MAX_SECONDS) stop();
  }, [recording, elapsed, stop]);

  const record = async (team: TeamId) => {
    setTarget(team);
    sfx.select();
    const take = await start();
    if (take && take !== NO_MIC) setTakes((prev) => ({ ...prev, [team]: take }));
    setTarget(null);
  };

  const play = (team: TeamId) => {
    const take = takes[team];
    if (!take) return;
    audioRef.current?.pause();
    const el = new Audio(take.url);
    audioRef.current = el;
    // Takes are played back through the same volume control as everything else.
    const release = bindMediaElement(el);
    setPlaying(team);
    el.onended = () => { release(); setPlaying(null); };
    void el.play().catch(() => { release(); setPlaying(null); });
  };

  const bothRecorded = Boolean(takes.a && takes.b);

  if (!voice) return null;

  return (
    <div className="stack gap center" style={{ width: 'min(94vw, 760px)' }}>
      <div className="voice-brief">
        <span className="eyebrow">Perform</span>
        <h2 className="voice-character">{voice.character}</h2>
        {voice.from !== 'generic' && <p className="voice-from">{voice.from}</p>}
        <p className="voice-direction">{voice.direction}</p>
      </div>

      {!recordable && (
        <p className="muted" style={{ fontSize: '0.88em', maxWidth: '46ch' }}>
          Recording needs a microphone on a secure connection. Perform out loud instead —
          the vote below still works.
        </p>
      )}
      {error && <p style={{ color: 'var(--bad)', fontSize: '0.88em', maxWidth: '46ch' }}>{error}</p>}

      <div className="voice-takes">
        {(['a', 'b'] as TeamId[]).map((team) => {
          const take = takes[team];
          const isTarget = recording && target === team;
          return (
            <div key={team} className="voice-take" style={{ ['--c' as string]: teamColours[team] }}>
              <span className="voice-team">{teamNames[team]}</span>

              {recordable && (
                <button
                  className={`btn ${isTarget ? 'btn-bad' : 'btn'}`}
                  disabled={recording && !isTarget}
                  onClick={() => (isTarget ? stop() : record(team))}
                >
                  {isTarget ? `⏹ Stop · ${MAX_SECONDS - elapsed}s` : take ? '↻ Re-record' : '⏺ Record'}
                </button>
              )}

              {take && (
                <>
                  <button className="btn btn-sm" onClick={() => play(team)} disabled={playing === team}>
                    {playing === team ? '♪ Playing…' : '▶ Play back'}
                  </button>
                  <div className="voice-stats">
                    <span>{take.stats.seconds}s</span>
                    <span>·</span>
                    <span title="Average loudness">energy {take.stats.energy}</span>
                    <span>·</span>
                    <span title="How much the loudness varies">range {take.stats.range}</span>
                  </div>
                </>
              )}

              {votes[team] > 0 && (
                <span className="voice-votes" style={{ ['--c' as string]: teamColours[team] }}>
                  {votes[team]} vote{votes[team] === 1 ? '' : 's'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="stack gap-sm center">
        <p className="eyebrow">Who did it better?</p>
        <div className="row gap-sm wrap-w" style={{ justifyContent: 'center' }}>
          {(['a', 'b'] as TeamId[]).map((team) => (
            <button key={team} className="btn btn-primary btn-lg"
              style={{ boxShadow: `0 20px 44px -22px ${teamColours[team]}` }}
              onClick={() => { sfx.correct(); onWinner(team); }}>
              {teamNames[team]}
            </button>
          ))}
          <button className="btn btn-ghost" onClick={() => onWinner(null)}>Tie</button>
          <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip</button>
        </div>
        {recordable && !bothRecorded && (
          <p className="dim" style={{ fontSize: '0.84em' }}>
            Recording is optional — you can just perform and vote.
          </p>
        )}
      </div>
    </div>
  );
}

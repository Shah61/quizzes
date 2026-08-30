'use client';

import { Suspense, useEffect, useState } from 'react';
import type { TeamId } from '@/game/types';
import { CATEGORY_EMOJI, CATEGORY_LABEL } from '@/game/types';
import { useGameClient } from '@/net/buzzers';
import { OpeningPlayer, RevealImage, TimerBar } from '@/components/bits';
import { primeAudio, sfx } from '@/game/sfx';

function PlayScreen() {
  const { status, snapshot, brand, join, send, leave } = useGameClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [team, setTeam] = useState<TeamId>('a');
  const [myPick, setMyPick] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<TeamId | null>(null);

  // A room code can be shared as a link: /play?room=ABCD
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('room');
    if (param) setCode(param.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
  }, []);

  // Clear the local pick whenever a new question comes round.
  useEffect(() => { setMyPick(null); setMyVote(null); }, [snapshot?.qIndex, snapshot?.roundIndex]);

  const teamName = (id: TeamId) => snapshot?.teamNames[id] ?? brand?.names[id] ?? (id === 'a' ? 'Team A' : 'Team B');
  const teamColour = (id: TeamId) => snapshot?.teamColours[id] ?? brand?.colours[id] ?? (id === 'a' ? '#3b82f6' : '#ef4444');

  /* ------------------------------------------------------------- join */

  if (status !== 'joined') {
    return (
      <div className="shell center" style={{ padding: 20 }}>
        <div className="panel panel-lg stack gap" style={{ padding: 26, width: '100%', maxWidth: 420 }}>
          <div>
            <h1 className="display" style={{ fontSize: '2.1rem' }}>Join the game</h1>
            <p className="muted" style={{ fontSize: '0.92em', marginTop: 6 }}>
              Ask the host for the four-letter room code. Everything plays on your own screen.
            </p>
          </div>

          <div className="field">
            <span className="label">Room code</span>
            <input
              className="input tabular" value={code} maxLength={4}
              autoCapitalize="characters" autoComplete="off" placeholder="ABCD"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              style={{ fontSize: '1.9rem', textAlign: 'center', letterSpacing: '0.4em', fontWeight: 800 }}
            />
          </div>

          <div className="field">
            <span className="label">Your name</span>
            <input className="input" value={name} maxLength={18} placeholder="Your name"
              onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <span className="label">Your team</span>
            <div className="row gap-sm">
              {(['a', 'b'] as TeamId[]).map((id) => (
                <button key={id} className="chip grow" data-on={team === id} onClick={() => setTeam(id)}
                  style={{ justifyContent: 'center', borderColor: team === id ? teamColour(id) : undefined }}>
                  {teamName(id)}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary btn-lg" disabled={code.length !== 4 || status === 'connecting'}
            onClick={() => { primeAudio(); join(code, name || 'Player', team); }}>
            {status === 'connecting' ? 'Connecting…' : 'Join the game'}
          </button>

          {status === 'error' && (
            <p style={{ color: 'var(--bad)', fontSize: '0.88em', textAlign: 'center', lineHeight: 1.5 }}>
              Could not reach that room. Check the code and make sure the host still has
              the game open, then try again.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- waiting room */

  if (!snapshot) {
    return (
      <div className="shell center" style={{ padding: 20, textAlign: 'center' }}>
        <div className="stack gap center">
          <h2 className="display" style={{ fontSize: '2rem', color: teamColour(team) }}>{teamName(team)}</h2>
          <p className="muted">You are in. Waiting for the host to start…</p>
          <button className="btn btn-ghost btn-sm" onClick={leave}>Leave</button>
        </div>
      </div>
    );
  }

  const s = snapshot;
  const myColour = teamColour(team);
  const iAmLockedOut = s.lockedOut.includes(team);
  const teamPick = s.picks[team] ?? myPick;

  const header = (
    <div className="play-header">
      {(['a', 'b'] as TeamId[]).map((id) => (
        <div key={id} className="play-team" data-me={id === team} style={{ ['--c' as string]: teamColour(id) }}>
          <span className="play-team-name">{teamName(id)}{id === team ? ' (you)' : ''}</span>
          <span className="play-team-score">{s.scores[id]}</span>
        </div>
      ))}
    </div>
  );

  let body: React.ReactNode;

  if (s.view === 'game-end') {
    const won = s.winner === team;
    body = (
      <div className="stack gap center" style={{ textAlign: 'center' }}>
        <p className="eyebrow">Final result</p>
        <h1 className="display" style={{ fontSize: 'clamp(2.4rem,12vw,4rem)', color: s.winner === 'tie' ? '#fff' : teamColour(s.winner as TeamId) }}>
          {s.winner === 'tie' ? "It's a tie" : `${teamName(s.winner as TeamId)} wins`}
        </h1>
        {s.winner !== 'tie' && <p className="muted">{won ? 'That is you. Well played.' : 'Better luck next round.'}</p>}
      </div>
    );
  } else if (s.view === 'round-end') {
    body = (
      <div className="stack gap center" style={{ textAlign: 'center' }}>
        <p className="eyebrow">Round {s.roundIndex + 1} complete</p>
        <h2 className="display" style={{ fontSize: '2rem' }}>{s.roundTitle}</h2>
        <p className="muted">Waiting for the next round…</p>
      </div>
    );
  } else if (s.view === 'round-intro' || s.view === 'lobby') {
    body = (
      <div className="stack gap center" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3.4rem', lineHeight: 1 }}>{s.roundEmoji}</div>
        <p className="eyebrow">Round {s.roundIndex + 1} of {s.roundTotal}</p>
        <h2 className="display" style={{ fontSize: 'clamp(2rem,9vw,3rem)' }}>{s.roundTitle}</h2>
        <p className="muted" style={{ maxWidth: '34ch' }}>{s.roundBlurb}</p>
        <p className="dim" style={{ fontSize: '0.9em' }}>Get ready…</p>
      </div>
    );
  } else {
    const revealed = s.view === 'revealed';
    body = (
      <div className="stack gap center" style={{ textAlign: 'center', width: '100%' }}>
        <div className="row gap-sm" style={{ justifyContent: 'center' }}>
          {s.category && <span className="category-badge">{CATEGORY_EMOJI[s.category]} {CATEGORY_LABEL[s.category]}</span>}
          <span className="tag">{s.qIndex + 1}/{s.qTotal}</span>
        </div>

        {s.voice ? (
          <div className="voice-brief">
            <span className="eyebrow">Perform</span>
            <h2 className="display voice-character">{s.voice.character}</h2>
            {s.voice.from !== 'generic' && <p className="voice-from">{s.voice.from}</p>}
            <p className="voice-direction">{s.voice.direction}</p>
          </div>
        ) : (
          <h2 className="question question-sm">{s.prompt}</h2>
        )}

        {s.canVote && (
          <div className="stack gap-sm center" style={{ width: '100%' }}>
            <p className="eyebrow">{myVote ? 'Vote cast' : 'Who did it better?'}</p>
            <div className="row gap-sm" style={{ justifyContent: 'center', width: '100%' }}>
              {(['a', 'b'] as TeamId[]).map((id) => (
                <button
                  key={id}
                  className="btn btn-lg grow"
                  disabled={Boolean(myVote)}
                  style={{
                    borderColor: teamColour(id),
                    color: teamColour(id),
                    opacity: myVote && myVote !== id ? 0.4 : 1,
                  }}
                  onClick={() => { sfx.select(); setMyVote(id); send({ type: 'vote', team: id }); }}
                >
                  {teamName(id)}
                  {s.votes[id] > 0 && <span className="dim"> · {s.votes[id]}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {s.audio && !revealed && (
          <OpeningPlayer src={s.audio} playing={s.audioPlaying} />
        )}
        {s.image && (
          <RevealImage
            src={s.image}
            sprite={s.sprite}
            progress={s.revealProgress}
            mode={s.roundKind === 'reveal' ? 'blur' : 'none'}
            frame={s.sprite ? 'square' : 'portrait'}
          />
        )}

        {s.seconds > 0 && !revealed && <TimerBar left={s.timeLeft} total={s.seconds} />}

        {s.hint && !revealed && <p className="hint-box">💡 {s.hint}</p>}

        {s.view === 'buzzed' && s.buzzed && (
          <p className="display" style={{ fontSize: '1.9rem', color: teamColour(s.buzzed) }}>
            {teamName(s.buzzed)} buzzed!
          </p>
        )}

        {revealed && (
          <div>
            <div className="answer-reveal display" style={{ fontSize: 'clamp(1.6rem,7vw,2.6rem)' }}>{s.answer}</div>
            {s.meta && <p className="answer-meta">{s.meta}</p>}
            {teamPick && (
              <p style={{ marginTop: 8, fontWeight: 700, color: teamPick === s.answer ? 'var(--good)' : 'var(--bad)' }}>
                {teamPick === s.answer ? 'Your team got it' : `Your team said ${teamPick}`}
              </p>
            )}
          </div>
        )}

        {/* Lock-in rounds: the four options, tappable. */}
        {s.lockRound && s.choices.length > 0 && (
          <div className="choices">
            {s.choices.map((choice, i) => {
              const stateAttr = revealed
                ? choice === s.answer ? 'correct' : teamPick === choice ? 'wrong' : 'muted'
                : teamPick === choice ? 'correct' : undefined;
              return (
                <button key={choice} className="choice" data-state={stateAttr}
                  disabled={revealed || !s.canLock || Boolean(teamPick)}
                  onClick={() => { sfx.select(); setMyPick(choice); send({ type: 'lock', choice }); }}>
                  <span className="choice-key">{i + 1}</span>
                  <span className="grow" style={{ textAlign: 'left' }}>{choice}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Buzzer rounds. */}
        {s.canBuzz && !revealed && (
          <button
            className="play-buzzer"
            style={{ ['--c' as string]: myColour }}
            disabled={iAmLockedOut || Boolean(s.buzzed)}
            onClick={() => {
              primeAudio(); sfx.buzz();
              if (navigator.vibrate) navigator.vibrate(60);
              send({ type: 'buzz' });
            }}
          >
            {iAmLockedOut ? 'LOCKED OUT' : s.buzzed ? 'TOO LATE' : 'BUZZ'}
          </button>
        )}

        {!s.canBuzz && !s.canLock && !revealed && s.view === 'question' && (
          <p className="muted" style={{ fontSize: '0.9em' }}>
            {s.activeTeam && s.activeTeam !== team
              ? `${teamName(s.activeTeam)} is answering…`
              : s.activeTeam === team
                ? 'Your team is up — answer out loud!'
                : s.hosted ? 'Answer out loud for the host.' : 'Watch the screen…'}
          </p>
        )}

        {teamPick && !revealed && (
          <p className="muted" style={{ fontSize: '0.9em' }}>Locked in — waiting for the other team…</p>
        )}
      </div>
    );
  }

  return (
    <div className="play-shell">
      {header}
      <div className="play-body">{body}</div>
      <button className="exit-btn" onClick={leave} aria-label="Leave the room" title="Leave">×</button>
    </div>
  );
}

export default function Page() {
  return <Suspense><PlayScreen /></Suspense>;
}

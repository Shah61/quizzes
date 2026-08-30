'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { GameConfig, TeamId } from '@/game/types';
import { CATEGORY_EMOJI, CATEGORY_LABEL, ROUND_INFO } from '@/game/types';
import {
  buildRounds, currentQuestion, currentRound, initialState, pointsFor, reducer, usesLockIn, winnerOf, CHAIN_LADDER,
} from '@/game/engine';
import { sfx } from '@/game/sfx';
import {
  BuzzBanner, Confetti, OpeningPlayer, RevealImage, ScoreNumber, TimerBar, TimerRing, Toast, Verdict,
} from './bits';
import OnlineRoom from './OnlineRoom';
import VoiceRound from './VoiceRound';
import MimicRound from './MimicRound';
import { findRef } from '@/game/mimic-refs';
import type { Sabotage } from '@/game/mimic-audio';
import type { Snapshot } from '@/net/protocol';

const TEAM_KEY: Record<TeamId, string> = { a: 'A', b: 'L' };
const MCQ_KEYS: Record<TeamId, string[]> = { a: ['1', '2', '3', '4'], b: ['7', '8', '9', '0'] };
/** Rounds where a buzz is meaningful — used to arm the phone buzzers. */
const BUZZ_ROUNDS = ['buzz', 'reveal', 'opening', 'ending', 'chain'];

export default function Arena({ config, onExit }: { config: GameConfig; onExit: () => void }) {
  const rounds = useMemo(() => buildRounds(config), [config]);
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(config, rounds));
  const [confetti, setConfetti] = useState(0);
  // Aimed by the wheel at the end of one Mimic question, applied to the next.
  const [sabotages, setSabotages] = useState<Partial<Record<TeamId, Sabotage>>>({});

  const round = currentRound(state);
  const q = currentQuestion(state);
  const teamOf = (id: TeamId) => config.teams.find((t) => t.id === id)!;

  /* ------------------------------------------------------------- clock */

  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(id);
  }, [state.running]);

  // Tick sounds for the last stretch of a timed round.
  const lastTick = useRef(-1);
  useEffect(() => {
    if (!state.running || state.timeLeft === lastTick.current) return;
    lastTick.current = state.timeLeft;
    if (state.timeLeft <= 5 && state.timeLeft > 0) sfx.tickUrgent();
    else if (state.timeLeft <= 10 && state.timeLeft > 0) sfx.tick();
  }, [state.timeLeft, state.running]);

  /* ---------------------------------------------------------- feedback */

  const fxNonce = state.fx.nonce;
  useEffect(() => {
    if (!fxNonce) return;
    if (state.fx.kind === 'good') sfx.correct();
    if (state.fx.kind === 'bad') sfx.wrong();
  }, [fxNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const bannerNonce = state.banner.nonce;
  useEffect(() => { if (bannerNonce) sfx.buzz(); }, [bannerNonce]);

  useEffect(() => {
    if (state.phase === 'game-end') { sfx.fanfare(); setConfetti((n) => n + 1); }
  }, [state.phase]);

  // No host means no "Next" button in a control bar — advance on a timer so the
  // game keeps moving on its own.
  useEffect(() => {
    if (config.hosted || state.phase !== 'revealed') return;
    const t = setTimeout(() => dispatch({ type: 'next' }), 3800);
    return () => clearTimeout(t);
  }, [config.hosted, state.phase, state.qIndex, state.roundIndex]);

  /* --------------------------------------------------------- shortcuts */

  const buzz = useCallback((team: TeamId) => dispatch({ type: 'buzz', team }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      const k = e.key.toLowerCase();

      // Buzzers
      if (k === 'a') { buzz('a'); return; }
      if (k === 'l') { buzz('b'); return; }

      // Multiple choice: each team has its own key block.
      if ((round?.kind === 'mcq' || !config.hosted) && state.phase === 'question' && q) {
        for (const team of ['a', 'b'] as TeamId[]) {
          const idx = MCQ_KEYS[team].indexOf(e.key);
          if (idx >= 0 && q.choices[idx]) {
            sfx.select();
            dispatch({ type: 'lock', team, choice: q.choices[idx] });
            return;
          }
        }
      }

      if (!config.hosted) return; // remaining keys are host controls

      if (state.phase === 'buzzed' && state.buzzed) {
        if (k === 'y') { dispatch({ type: 'verdict', team: state.buzzed, correct: true }); return; }
        if (k === 'n') { dispatch({ type: 'verdict', team: state.buzzed, correct: false }); return; }
      }
      if (k === 'h') { sfx.hint(); dispatch({ type: 'hint' }); return; }
      if (e.key === ' ') {
        e.preventDefault();
        if (state.phase === 'question' || state.phase === 'buzzed') { sfx.reveal(); dispatch({ type: 'reveal' }); }
        else if (state.phase === 'revealed') dispatch({ type: 'next' });
        return;
      }
      if (e.key === 'Enter') {
        if (state.phase === 'round-intro') { sfx.start(); dispatch({ type: 'start-round' }); }
        else if (state.phase === 'revealed') dispatch({ type: 'next' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [buzz, config.hosted, round?.kind, state.phase, state.buzzed, q]);

  /* ------------------------------------------------------------ guards */

  if (!rounds.length) {
    return (
      <div className="shell wrap center" style={{ minHeight: '100dvh', textAlign: 'center' }}>
        <div className="stack gap">
          <h2 className="display" style={{ fontSize: '2rem' }}>No questions matched those settings</h2>
          <p className="muted">Try turning on more topics or a different set of rounds.</p>
          <button className="btn btn-primary" onClick={onExit}>Back to setup</button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ pieces */

  const revealProgress = round?.seconds && round.kind === 'reveal'
    ? state.phase === 'revealed' ? 1 : 1 - state.timeLeft / round.seconds
    : 1;

  // Everything a player's device needs to draw the game for itself.
  const snapshot: Snapshot = {
    view:
      state.phase === 'wager-set' ? 'lobby'
        : state.phase === 'round-intro' ? 'round-intro'
        : state.phase === 'question' ? 'question'
        : state.phase === 'buzzed' ? 'buzzed'
        : state.phase === 'revealed' ? 'revealed'
        : state.phase === 'round-end' ? 'round-end'
        : 'game-end',
    roundKind: round?.kind ?? null,
    roundTitle: round ? ROUND_INFO[round.kind].title : '',
    roundBlurb: round ? ROUND_INFO[round.kind].blurb : '',
    roundEmoji: round ? ROUND_INFO[round.kind].emoji : '',
    roundIndex: state.roundIndex,
    roundTotal: rounds.length,
    qIndex: state.qIndex,
    qTotal: round?.questions.length ?? 0,
    category: q?.category ?? null,
    prompt: q?.prompt ?? '',
    choices: q?.choices ?? [],
    // Withhold the cover art of an audio question until the answer is out.
    image: q?.audio && state.phase !== 'revealed' ? null : q?.image ?? null,
    audio: q?.audio ?? null,
    audioPlaying: Boolean(q?.audio) && state.phase === 'question' && (round?.seconds ? state.running : true),
    sprite: Boolean(q?.sprite),
    revealProgress: round?.kind === 'reveal' ? revealProgress : 1,
    hint: state.hintShown ? q?.hint ?? null : null,
    meta: state.phase === 'revealed' ? q?.meta ?? null : null,
    answer: state.phase === 'revealed' ? q?.answer ?? null : null,
    timeLeft: state.timeLeft,
    seconds: round?.seconds ?? 0,
    teamNames: { a: teamOf('a').name, b: teamOf('b').name },
    teamColours: { a: teamOf('a').colour, b: teamOf('b').colour },
    scores: state.scores,
    buzzed: state.buzzed,
    lockedOut: state.lockedOut,
    picks: state.phase === 'revealed' ? state.picks : {},
    canBuzz: config.hosted && state.phase === 'question' && BUZZ_ROUNDS.includes(round?.kind ?? ''),
    canLock: usesLockIn(state) && state.phase === 'question',
    lockRound: usesLockIn(state) && round?.kind !== 'voice' && round?.kind !== 'mimic',
    voice: round?.kind === 'voice' ? q?.voice ?? null : null,
    canVote: round?.kind === 'voice' && state.phase === 'question',
    votes: state.votes,
    hosted: config.hosted,
    chainPot: state.chainPot,
    activeTeam: round?.kind === 'rapid' ? state.rapidTeam : round?.kind === 'chain' ? state.chainTeam : null,
    winner: state.phase === 'game-end' ? winnerOf(state) : null,
  };

  const Scoreboard = (
    <div className="wrap">
      <div className="scoreboard">
        {(['a', 'b'] as TeamId[]).map((id) => {
          const team = teamOf(id);
          const active = round?.kind === 'rapid' ? state.rapidTeam === id
            : round?.kind === 'chain' ? state.chainTeam === id : false;
          return (
            <div
              key={id}
              className="team-card"
              data-side={id === 'b' ? 'b' : 'a'}
              data-buzzed={state.buzzed === id}
              data-locked={state.lockedOut.includes(id)}
              data-active={active}
              style={{ ['--c' as string]: team.colour }}
            >
              <span className="team-dot" />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="team-name">{team.name}</div>
                <div className="team-meta">
                  {active ? 'their turn' : state.lockedOut.includes(id) ? 'locked out' : `buzz: ${TEAM_KEY[id]}`}
                </div>
              </div>
              <ScoreNumber value={state.scores[id]} bump={state.scoreFx[id]} colour={team.colour} />
            </div>
          );
        })}
        <div className="round-pill">
          <span className="round-num">{Math.min(state.roundIndex + 1, rounds.length)}<span className="dim">/{rounds.length}</span></span>
          <span className="round-kind">{round ? ROUND_INFO[round.kind].title : ''}</span>
        </div>
      </div>
    </div>
  );

  const buzzers = (
    <div className="buzz-row">
      {(['a', 'b'] as TeamId[]).map((id) => {
        const team = teamOf(id);
        return (
          <button
            key={id}
            className="buzzer"
            style={{ ['--c' as string]: team.colour }}
            disabled={state.phase !== 'question' || state.lockedOut.includes(id)}
            onClick={() => buzz(id)}
          >
            {team.name}
            <small>press {TEAM_KEY[id]}</small>
          </button>
        );
      })}
    </div>
  );

  // An audio question must never show its cover art while it is being asked —
  // the artwork is the answer. Play the track instead, and only show the cover
  // once the answer is out. Untimed rounds play as soon as the question is up.
  const audioPlaying = state.phase === 'question' && (round?.seconds ? state.running : true);

  const questionMedia = !q ? null
    : q.audio ? (
      state.phase === 'revealed' && q.image ? (
        <RevealImage src={q.image} progress={1} mode="none" frame="portrait" />
      ) : (
        <OpeningPlayer
          src={q.audio}
          playing={audioPlaying}
          onEnded={() => dispatch({ type: 'reveal' })}
        />
      )
    ) : q.image ? (
      <RevealImage
        src={q.image}
        sprite={q.sprite}
        progress={round?.kind === 'reveal' ? revealProgress : 1}
        mode={round?.kind === 'reveal' ? 'blur' : 'none'}
        frame={q.sprite ? 'square' : 'portrait'}
      />
    ) : null;

  /* ------------------------------------------------------------- stage */

  let stage: React.ReactNode = null;

  if (state.phase === 'game-end') {
    const w = winnerOf(state);
    const champ = w === 'tie' ? null : teamOf(w);
    stage = (
      <div className="wrap podium">
        <p className="eyebrow">Final result</p>
        <h1 className="winner-name display" style={{ ['--c' as string]: champ?.colour ?? '#fff' }}>
          {champ ? `${champ.name} wins` : "It's a tie"}
        </h1>
        <div className="final-scores">
          {(['a', 'b'] as TeamId[]).map((id) => (
            <div key={id} className="final-card" style={{ ['--c' as string]: teamOf(id).colour }}>
              <div className="team-meta">{teamOf(id).name}</div>
              <div className="team-score" style={{ ['--c' as string]: teamOf(id).colour }}>{state.scores[id]}</div>
            </div>
          ))}
        </div>
        <div className="row gap-sm wrap-w" style={{ justifyContent: 'center', marginTop: 10 }}>
          <button className="btn btn-primary btn-lg" onClick={onExit}>Play again</button>
        </div>
      </div>
    );
  } else if (state.phase === 'round-end') {
    const isLast = state.roundIndex >= rounds.length - 1;
    stage = (
      <div className="stage wrap">
        <p className="eyebrow">Round {state.roundIndex + 1} complete</p>
        <h2 className="display" style={{ fontSize: 'clamp(2rem,6vw,4rem)' }}>{round && ROUND_INFO[round.kind].title}</h2>
        <div className="final-scores">
          {(['a', 'b'] as TeamId[]).map((id) => (
            <div key={id} className="final-card" style={{ ['--c' as string]: teamOf(id).colour }}>
              <div className="team-meta">{teamOf(id).name}</div>
              <div className="team-score" style={{ ['--c' as string]: teamOf(id).colour }}>{state.scores[id]}</div>
            </div>
          ))}
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => {
            sfx.start();
            dispatch(isLast ? { type: 'end-game' } : { type: 'next-round' });
          }}
        >
          {isLast ? 'See the final result' : 'Next round →'}
        </button>
      </div>
    );
  } else if (state.phase === 'round-intro' && round) {
    const info = ROUND_INFO[round.kind];
    const rapidTurn = round.kind === 'rapid';
    stage = (
      <div className="stage wrap">
        <p className="eyebrow">Round {state.roundIndex + 1} of {rounds.length}</p>
        <div style={{ fontSize: '4.5rem', lineHeight: 1 }}>{info.emoji}</div>
        <h2 className="display" style={{ fontSize: 'clamp(2.4rem,8vw,5rem)' }}>{info.title}</h2>
        <p className="muted" style={{ maxWidth: '46ch' }}>{info.blurb}</p>
        {rapidTurn && (
          <p className="category-badge" style={{ background: 'transparent', borderColor: teamOf(state.rapidTeam).colour, color: teamOf(state.rapidTeam).colour }}>
            {teamOf(state.rapidTeam).name} is up
          </p>
        )}
        <p className="muted" style={{ fontSize: '0.9em' }}>
          {round.points > 0 && `${round.points} points a question`}
          {round.seconds ? ` · ${round.seconds}s on the clock` : ''}
        </p>
        <button className="btn btn-primary btn-lg" onClick={() => { sfx.start(); dispatch({ type: 'start-round' }); }}>
          Start round
        </button>
      </div>
    );
  } else if (state.phase === 'wager-set' && round) {
    stage = (
      <div className="stage wrap">
        <p className="eyebrow">Final Wager</p>
        <h2 className="display" style={{ fontSize: 'clamp(2rem,6vw,3.4rem)' }}>Place your bets</h2>
        <p className="muted" style={{ maxWidth: '44ch' }}>
          Each team bets before seeing the question. Get it right and you win the bet — get it wrong and you lose it.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 18, width: 'min(92vw,620px)' }}>
          {(['a', 'b'] as TeamId[]).map((id) => (
            <div key={id} className="final-card" style={{ ['--c' as string]: teamOf(id).colour, textAlign: 'center' }}>
              <div className="team-meta">{teamOf(id).name}</div>
              <div className="muted" style={{ fontSize: '0.82em', marginBottom: 10 }}>has {state.scores[id]} points</div>
              <input
                className="input tabular"
                type="number"
                min={0}
                max={Math.max(10, state.scores[id])}
                value={state.wagers[id]}
                onChange={(e) => dispatch({ type: 'set-wager', team: id, amount: Number(e.target.value) })}
                style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 800 }}
              />
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => { sfx.start(); dispatch({ type: 'confirm-wagers' }); }}>
          Lock in the bets →
        </button>
      </div>
    );
  } else if (q && round?.kind === 'mimic' && state.phase === 'question') {
    const reference = q.mimicId ? findRef(q.mimicId) : null;
    stage = (
      <div className="stage wrap">
        <span className="category-badge">🔊 Mimic · {state.qIndex + 1}/{round.questions.length}</span>
        {reference && (
          <MimicRound
            key={q.id}
            reference={reference}
            teamNames={{ a: teamOf('a').name, b: teamOf('b').name }}
            teamColours={{ a: teamOf('a').colour, b: teamOf('b').colour }}
            sabotages={sabotages}
            onFinish={(winner, _scores, next) => {
              // The wheel's pick lands on the next sound, not this one.
              setSabotages(next?.sabotage ? { [next.team]: next.sabotage } : {});
              dispatch({ type: 'voice-result', team: winner });
            }}
          />
        )}
      </div>
    );
  } else if (q && round?.kind === 'voice' && state.phase === 'question') {
    stage = (
      <div className="stage wrap">
        <span className="category-badge">🎤 Voice Battle</span>
        <VoiceRound
          question={q}
          teamNames={{ a: teamOf('a').name, b: teamOf('b').name }}
          teamColours={{ a: teamOf('a').colour, b: teamOf('b').colour }}
          votes={state.votes}
          onWinner={(team) => dispatch({ type: 'voice-result', team })}
          onSkip={() => dispatch({ type: 'reveal' })}
        />
      </div>
    );
  } else if (q && round) {
    const revealed = state.phase === 'revealed';
    const lockIn = usesLockIn(state);
    const showChoices = lockIn;

    stage = (
      <div className="stage wrap">
        <span className="category-badge">
          {CATEGORY_EMOJI[q.category]} {CATEGORY_LABEL[q.category]}
        </span>

        {round.kind === 'chain' && (
          <div className="row gap-sm" style={{ justifyContent: 'center' }}>
            <span className="streak">🔥 streak {state.chainStreak}</span>
            <span className="tag" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
              pot {state.chainPot}
            </span>
            <span className="tag">next {CHAIN_LADDER[Math.min(state.chainStreak, CHAIN_LADDER.length - 1)]}</span>
          </div>
        )}

        {round.kind === 'rapid' && (
          <p className="eyebrow" style={{ color: teamOf(state.rapidTeam).colour }}>
            {teamOf(state.rapidTeam).name} · {state.rapidScored[state.rapidTeam]} correct
          </p>
        )}

        <h2 className={`question ${questionMedia ? 'question-sm' : ''}`}>{q.prompt}</h2>

        {questionMedia}

        {round.seconds && !revealed && (
          round.kind === 'rapid' || round.kind === 'mcq'
            ? <TimerBar left={state.timeLeft} total={round.seconds} />
            : <TimerRing left={state.timeLeft} total={round.seconds} />
        )}

        {state.hintShown && q.hint && !revealed && (
          <p className="hint-box">💡 {q.hint}</p>
        )}

        {revealed && (
          <div>
            <div className="answer-reveal display">{q.answer}</div>
            {q.meta && <p className="answer-meta">{q.meta}</p>}
          </div>
        )}

        {/* Multiple choice grid — the whole interface in no-host mode. */}
        {showChoices && (
          <div className="choices">
            {q.choices.map((choice, i) => {
              const pickedBy = (['a', 'b'] as TeamId[]).filter((t) => state.picks[t] === choice);
              const stateAttr = revealed
                ? choice === q.answer ? 'correct' : pickedBy.length ? 'wrong' : 'muted'
                : undefined;
              return (
                <button
                  key={choice}
                  className="choice"
                  data-state={stateAttr}
                  disabled={revealed || !lockIn}
                  onClick={() => {
                    // Tapping assigns to whichever team has not locked in yet.
                    const team: TeamId | null = !state.picks.a ? 'a' : !state.picks.b ? 'b' : null;
                    if (!team) return;
                    sfx.select();
                    dispatch({ type: 'lock', team, choice });
                  }}
                >
                  <span className="choice-key">{i + 1}</span>
                  <span className="grow">{choice}</span>
                  <span className="picks">
                    {pickedBy.map((t) => (
                      <span key={t} className="pick-chip" style={{ ['--c' as string]: teamOf(t).colour }}>
                        {teamOf(t).name.slice(0, 8)}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {lockIn && !revealed && (
          <p className="muted" style={{ fontSize: '0.86em' }}>
            <b style={{ color: teamOf('a').colour }}>{teamOf('a').name}</b> presses{' '}
            <span className="kbd">1</span>–<span className="kbd">4</span> &nbsp;·&nbsp;
            <b style={{ color: teamOf('b').colour }}>{teamOf('b').name}</b> presses{' '}
            <span className="kbd">7</span>–<span className="kbd">0</span>
          </p>
        )}

        {/* Buzzers for the race rounds. */}
        {config.hosted && BUZZ_ROUNDS.includes(round.kind) && !revealed && buzzers}

        {round.kind === 'wager' && !revealed && (
          <div className="row gap wrap-w" style={{ justifyContent: 'center' }}>
            {(['a', 'b'] as TeamId[]).map((id) => (
              <div key={id} className="final-card" style={{ ['--c' as string]: teamOf(id).colour, textAlign: 'center', minWidth: 210 }}>
                <div className="team-meta">{teamOf(id).name} bet {state.wagers[id]}</div>
                <div className="row gap-sm" style={{ justifyContent: 'center', marginTop: 12 }}>
                  <button className="btn btn-good btn-sm" disabled={state.wagerResult[id] !== undefined}
                    onClick={() => dispatch({ type: 'wager-verdict', team: id, correct: true })}>✓ Right</button>
                  <button className="btn btn-bad btn-sm" disabled={state.wagerResult[id] !== undefined}
                    onClick={() => dispatch({ type: 'wager-verdict', team: id, correct: false })}>✗ Wrong</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------- host bar */

  const hostBar = config.hosted && !['game-end', 'round-intro', 'wager-set'].includes(state.phase) && (
    <div className="hostbar">
      <div className="wrap hostbar-inner">
        {state.phase === 'buzzed' && state.buzzed && (
          <>
            <span className="eyebrow" style={{ color: teamOf(state.buzzed).colour }}>
              {teamOf(state.buzzed).name} buzzed
            </span>
            <button className="btn btn-good" onClick={() => dispatch({ type: 'verdict', team: state.buzzed!, correct: true })}>
              ✓ Correct <span className="kbd">Y</span>
              {round && ['reveal', 'opening', 'ending'].includes(round.kind) && <span className="dim">+{pointsFor(state)}</span>}
            </button>
            <button className="btn btn-bad" onClick={() => dispatch({ type: 'verdict', team: state.buzzed!, correct: false })}>
              ✗ Wrong <span className="kbd">N</span>
            </button>
            <span className="divider" />
          </>
        )}

        {round?.kind === 'rapid' && state.phase === 'question' && (
          <>
            <button className="btn btn-good" onClick={() => { sfx.correct(); dispatch({ type: 'rapid-mark', correct: true }); }}>
              ✓ Correct <span className="dim">+{round.points}</span>
            </button>
            <button className="btn btn-ghost" onClick={() => dispatch({ type: 'rapid-mark', correct: false })}>Pass →</button>
            <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'toggle-clock' })}>
              {state.running ? '⏸ Pause' : '▶ Start'}
            </button>
            <span className="divider" />
          </>
        )}

        {round?.kind === 'chain' && state.phase !== 'revealed' && (
          <>
            <button className="btn btn-gold" disabled={state.chainPot === 0}
              onClick={() => { sfx.bank(); dispatch({ type: 'chain-bank' }); }}>
              🏦 Bank {state.chainPot || ''}
            </button>
            <span className="divider" />
          </>
        )}

        {state.phase === 'question' && q?.hint && !state.hintShown && (
          <button className="btn btn-gold" onClick={() => { sfx.hint(); dispatch({ type: 'hint' }); }}>
            💡 Hint <span className="kbd">H</span>
          </button>
        )}

        {state.phase !== 'revealed' && round?.kind !== 'rapid' && (
          <button className="btn" onClick={() => { sfx.reveal(); dispatch({ type: 'reveal' }); }}>
            Show answer <span className="kbd">Space</span>
          </button>
        )}

        {state.phase === 'revealed' && (
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'next' })}>
            Next <span className="kbd">Space</span>
          </button>
        )}

        <span className="divider" />
        {(['a', 'b'] as TeamId[]).map((id) => (
          <span key={id} className="row gap-xs">
            <button className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: 'adjust', team: id, delta: -5 })}
              title={`Remove 5 from ${teamOf(id).name}`}>−5</button>
            <span className="eyebrow" style={{ color: teamOf(id).colour }}>{teamOf(id).name.slice(0, 10)}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: 'adjust', team: id, delta: 5 })}
              title={`Give 5 to ${teamOf(id).name}`}>+5</button>
          </span>
        ))}
        <span className="divider" />
        <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'skip-round' })}>Skip round</button>
      </div>
    </div>
  );

  /* ------------------------------------------------------------ render */

  return (
    <div className="arena">
      {Scoreboard}
      {stage}
      {hostBar}

      {state.banner.team && (
        <BuzzBanner
          name={teamOf(state.banner.team).name}
          colour={teamOf(state.banner.team).colour}
          nonce={state.banner.nonce}
        />
      )}
      <Verdict kind={state.fx.kind} nonce={state.fx.nonce} />
      <Toast toast={state.toast} />
      <Confetti nonce={confetti} colours={[teamOf('a').colour, teamOf('b').colour, '#ffc53d', '#ffffff']} />

      <OnlineRoom
        teams={{
          a: { name: teamOf('a').name, colour: teamOf('a').colour },
          b: { name: teamOf('b').name, colour: teamOf('b').colour },
        }}
        snapshot={snapshot}
        onAction={(team, action) => {
          if (action.type === 'buzz') buzz(team);
          else if (action.type === 'vote') dispatch({ type: 'vote', team: action.team });
          else dispatch({ type: 'lock', team, choice: action.choice });
        }}
      />
      <button className="exit-btn" onClick={onExit} aria-label="Exit to menu" title="Exit">×</button>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { GameConfig, TeamId } from '@/game/types';
import { CATEGORY_EMOJI, CATEGORY_LABEL, ROUND_INFO } from '@/game/types';
import {
  buildRounds, currentQuestion, currentRound, initialState, pointsFor, reducer, turnTeam, usesLockIn, winnerOf, CHAIN_LADDER,
} from '@/game/engine';
import { playingTeams } from '@/game/types';
import { recordDaily, type DailyRecord } from '@/game/daily';
import { themeFor, themeVars } from '@/game/theme';
import { sfx } from '@/game/sfx';
import {
  BuzzBanner, Confetti, OpeningPlayer, PRELOAD_AHEAD, RevealImage, ScoreNumber, TimerBar, TimerRing, Toast, Verdict,
} from './bits';
import { Cta, Hud, Rail, Screen, Wordmark, type RailItem } from './Shell';
import OnlineRoom from './OnlineRoom';
import VoiceRound from './VoiceRound';
import MimicRound from './MimicRound';
import GeoRound from './GeoRound';
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
  // Typed-answer mode: what the team at the keyboard has entered so far.
  const [typed, setTyped] = useState('');
  const [daily, setDaily] = useState<DailyRecord | null>(null);

  const round = currentRound(state);
  const q = currentQuestion(state);
  const teamOf = (id: TeamId) => config.teams.find((t) => t.id === id)!;
  // One entry in a solo game, so every two-team layout below collapses to one.
  const teams = playingTeams(config);
  const turn = turnTeam(state);
  // Whether the answer keys, rather than the buzzers, are what this round uses.
  const lockInKeys = usesLockIn(state);
  // The round's own colours and display face. Set as custom properties on the
  // screen, so the wash, the headings and every accent follow along without a
  // single child component knowing which round it is in.
  const theme = themeFor(round?.kind);

  // The rest of the round's tracks, so the player can pull them ahead of time
  // instead of making the room wait once per song. Memoised on the index so the
  // queue is a stable array and mounted elements are not torn down each render.
  const upcomingTracks = useMemo(
    () => (round?.questions ?? [])
      .slice(state.qIndex + 1, state.qIndex + 1 + PRELOAD_AHEAD)
      .filter((n) => n.audio)
      .map((n) => ({ src: n.audio as string, fallback: n.audioFallback })),
    [round, state.qIndex],
  );

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
    if (state.phase !== 'game-end') return;
    sfx.fanfare();
    setConfetti((n) => n + 1);
    // A daily run is the only one that leaves anything behind.
    if (config.dailySeed !== undefined) setDaily(recordDaily(state.scores.a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // No host means no "Next" button in a control bar — advance on a timer so the
  // game keeps moving on its own.
  useEffect(() => {
    if (config.hosted || state.phase !== 'revealed') return;
    // The Chain is the exception: moving on by itself would take the decision
    // the round is built around — bank it or risk it — away from the player.
    if (round?.kind === 'chain') return;
    const t = setTimeout(() => dispatch({ type: 'next' }), 3800);
    return () => clearTimeout(t);
  }, [config.hosted, round?.kind, state.phase, state.qIndex, state.roundIndex]);

  /* --------------------------------------------------------- shortcuts */

  useEffect(() => { setTyped(''); }, [state.qIndex, state.roundIndex, state.phase]);

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
        for (const team of teams) {
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
      <Screen>
        <Hud><Wordmark jp="クイズ" /></Hud>
        <div className="screen-main">
          <div className="stage">
            <div className="round-intro">
              <h2 className="round-intro-title">Nothing matched</h2>
              <hr className="round-intro-rule" />
              <p className="card-note" style={{ textAlign: 'center' }}>
                No questions came back for those settings. Try turning on more topics,
                or a different set of rounds.
              </p>
              <Cta onClick={onExit} arrow="←">Back to setup</Cta>
            </div>
          </div>
        </div>
      </Screen>
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
    answerMode: config.answerMode,
    chainPot: state.chainPot,
    activeTeam: round?.kind === 'rapid' ? state.rapidTeam : round?.kind === 'chain' ? state.chainTeam : null,
    winner: state.phase === 'game-end' ? winnerOf(state) : null,
  };

  const Scoreboard = (
    <div className="scoreboard">
      {teams.map((id) => {
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
            <div className="grow">
              <div className="team-name">{team.name}</div>
              <div className="team-meta">
                {active ? 'their turn'
                  : state.lockedOut.includes(id) ? 'locked out'
                  // Advertising a buzzer key in a game with no buzzers is the
                  // clearest way to make a no-host game look like a hosted one.
                  : config.solo ? 'solo run'
                  : lockInKeys ? `keys ${MCQ_KEYS[id][0]}–${MCQ_KEYS[id][3]}`
                  : `buzz: ${TEAM_KEY[id]}`}
              </div>
            </div>
            <ScoreNumber value={state.scores[id]} bump={state.scoreFx[id]} colour={team.colour} />
          </div>
        );
      })}
      <div className="round-pill">
        <span className="round-num">{Math.min(state.roundIndex + 1, rounds.length)}<span>/{rounds.length}</span></span>
        <span className="round-kind">{round ? ROUND_INFO[round.kind].title : ''}</span>
      </div>
    </div>
  );

  const buzzers = (
    <div className="buzz-row">
      {teams.map((id) => {
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

  // The cover art replaces the player on screen once the answer is out, but the
  // player itself stays mounted and merely hidden. Swapping the two as siblings
  // in a ternary unmounted it every reveal, and with it the whole preload queue
  // — which is worth nothing if it is thrown away once a question.
  const coverShowing = state.phase === 'revealed' && Boolean(q?.image);

  const questionMedia = !q ? null
    : q.audio ? (
      <>
        {coverShowing && <RevealImage src={q.image!} progress={1} mode="none" frame="portrait" />}
        <div style={coverShowing ? { display: 'none' } : undefined}>
          <OpeningPlayer
            src={q.audio}
            fallback={q.audioFallback}
            upcoming={upcomingTracks}
            playing={audioPlaying}
            onEnded={() => dispatch({ type: 'reveal' })}
          />
        </div>
      </>
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
      <div className="stage">
        <div className="podium">
          <p className="eyebrow">Final result</p>
          <h1 className="winner-name" style={{ ['--c' as string]: champ?.colour ?? 'var(--accent)' }}>
            {config.solo ? `${state.scores.a} points` : champ ? `${champ.name} wins` : "It's a tie"}
          </h1>
          {daily && (
            <div className="row gap-sm wrap-w" style={{ justifyContent: 'center' }}>
              <span className="category-badge">🔥 {daily.streak} day streak</span>
              <span className="category-badge">Best {daily.bestScore}</span>
              <span className="category-badge">{daily.played} day{daily.played === 1 ? '' : 's'} played</span>
            </div>
          )}
          <div className="final-scores">
            {teams.map((id) => (
              <div key={id} className="final-card" style={{ ['--c' as string]: teamOf(id).colour }}>
                <div className="team-meta">{teamOf(id).name}</div>
                <div className="team-score" style={{ ['--c' as string]: teamOf(id).colour }}>{state.scores[id]}</div>
              </div>
            ))}
          </div>
          <Cta className="btn-lg" onClick={onExit} arrow="↺">Play again</Cta>
        </div>
      </div>
    );
  } else if (state.phase === 'round-end') {
    const isLast = state.roundIndex >= rounds.length - 1;
    stage = (
      <div className="stage">
        <p className="eyebrow">Round {state.roundIndex + 1} complete</p>
        <h2 className="display" style={{ fontSize: 'clamp(2rem,6vw,4rem)', color: '#fff', textShadow: '0 6px 30px rgba(0,0,0,.6)' }}>
          {round && ROUND_INFO[round.kind].title}
        </h2>
        <div className="final-scores">
          {teams.map((id) => (
            <div key={id} className="final-card" style={{ ['--c' as string]: teamOf(id).colour }}>
              <div className="team-meta">{teamOf(id).name}</div>
              <div className="team-score" style={{ ['--c' as string]: teamOf(id).colour }}>{state.scores[id]}</div>
            </div>
          ))}
        </div>
        <Cta
          className="btn-lg"
          arrow="→"
          onClick={() => {
            sfx.start();
            dispatch(isLast ? { type: 'end-game' } : { type: 'next-round' });
          }}
        >
          {isLast ? 'See the final result' : 'Next round'}
        </Cta>
      </div>
    );
  } else if (state.phase === 'round-intro' && round) {
    const info = ROUND_INFO[round.kind];
    stage = (
      <div className="stage">
        <div className="round-intro">
          <p className="eyebrow">Round {state.roundIndex + 1} of {rounds.length}</p>
          <div className="round-intro-emoji">{info.emoji}</div>
          <h2 className="round-intro-title">{info.title}</h2>
          <hr className="round-intro-rule" />
          <p className="card-note" style={{ textAlign: 'center', maxWidth: '42ch' }}>{info.blurb}</p>
          {round.kind === 'rapid' && (
            <span className="category-badge" style={{ borderColor: teamOf(state.rapidTeam).colour, color: teamOf(state.rapidTeam).colour }}>
              {teamOf(state.rapidTeam).name} is up
            </span>
          )}
          <p className="dim" style={{ fontSize: '0.86em' }}>
            {round.points > 0 && `${round.points} points a question`}
            {round.seconds ? ` · ${round.seconds}s on the clock` : ''}
          </p>
          <Cta className="btn-lg" arrow="→" onClick={() => { sfx.start(); dispatch({ type: 'start-round' }); }}>
            Start round
          </Cta>
        </div>
      </div>
    );
  } else if (state.phase === 'wager-set' && round) {
    stage = (
      <div className="stage">
        <p className="eyebrow">Final Wager</p>
        <h2 className="display" style={{ fontSize: 'clamp(2rem,6vw,3.4rem)', color: '#fff', textShadow: '0 6px 30px rgba(0,0,0,.6)' }}>
          Place your bets
        </h2>
        <p className="muted" style={{ maxWidth: '44ch' }}>
          {config.solo
            ? 'Bet before you see the question. Get it right and you win the bet — get it wrong and you lose it.'
            : 'Each team bets before seeing the question. Get it right and you win the bet — get it wrong and you lose it.'}
        </p>
        <div className="final-scores">
          {teams.map((id) => (
            <div key={id} className="final-card" style={{ ['--c' as string]: teamOf(id).colour, minWidth: 230 }}>
              <div className="team-meta">{teamOf(id).name}</div>
              <div className="dim" style={{ fontSize: '0.82em', marginBottom: 10 }}>has {state.scores[id]} points</div>
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
        <Cta className="btn-lg" arrow="→" onClick={() => { sfx.start(); dispatch({ type: 'confirm-wagers' }); }}>
          Lock in the bets
        </Cta>
      </div>
    );
  } else if (q && round?.kind === 'mimic' && state.phase === 'question') {
    const reference = q.mimicId ? findRef(q.mimicId) : null;
    stage = (
      <div className="stage">
        <span className="category-badge">🔊 Mimic · {state.qIndex + 1}/{round.questions.length}</span>
        {reference && (
          <MimicRound
            key={q.id}
            reference={reference}
            teams={teams}
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
  } else if (q && (round?.kind === 'geo' || round?.kind === 'street') && state.phase === 'question') {
    stage = (
      <div className="stage" style={{ justifyContent: 'flex-start' }}>
        <span className="category-badge">
          {ROUND_INFO[round.kind].emoji} {ROUND_INFO[round.kind].title} · {state.qIndex + 1}/{round.questions.length}
        </span>
        <GeoRound
          key={q.id}
          question={q}
          teams={teams}
          teamNames={{ a: teamOf('a').name, b: teamOf('b').name }}
          teamColours={{ a: teamOf('a').colour, b: teamOf('b').colour }}
          points={round.points}
          onFinish={(pts) => dispatch({ type: 'geo-result', points: pts })}
        />
      </div>
    );
  } else if (q && round?.kind === 'voice' && state.phase === 'question') {
    stage = (
      <div className="stage">
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
    // Rapid fire and the multiple-choice round are paced by a bar across the
    // screen; everything else counts down on a ring.
    const barClock = round.kind === 'rapid' || round.kind === 'mcq';
    const showClock = Boolean(round.seconds) && !revealed;
    const ringOnMedia = showClock && !barClock && Boolean(questionMedia);

    stage = (
      <div className="stage">
        <div className="row gap-sm wrap-w" style={{ justifyContent: 'center' }}>
          <span className="category-badge">
            {CATEGORY_EMOJI[q.category]} {CATEGORY_LABEL[q.category]}
          </span>
          <span className="tag">{state.qIndex + 1}/{round.questions.length}</span>
          {round.kind === 'chain' && (
            <>
              <span className="streak">🔥 streak {state.chainStreak}</span>
              <span className="tag" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>pot {state.chainPot}</span>
              <span className="tag">next {CHAIN_LADDER[Math.min(state.chainStreak, CHAIN_LADDER.length - 1)]}</span>
            </>
          )}
          {round.kind === 'rapid' && (
            <span className="tag" style={{ borderColor: teamOf(state.rapidTeam).colour, color: teamOf(state.rapidTeam).colour }}>
              {teamOf(state.rapidTeam).name} · {state.rapidScored[state.rapidTeam]} correct
            </span>
          )}
        </div>

        {/* The question itself, on a pale sheet so it always reads over art. */}
        <div className="question-card">
          <h2 className={`question ${questionMedia ? 'question-sm' : ''}`}>{q.prompt}</h2>
          {revealed && (
            <div style={{ marginTop: 18 }}>
              <div className="answer-reveal">{q.answer}</div>
              {q.meta && <p className="answer-meta">{q.meta}</p>}
            </div>
          )}
        </div>

        {/*
          The clock rides on the corner of the picture rather than sitting
          under it. Stacked, the two of them together left no room for the
          buzzers on a laptop screen, and a countdown pinned to the thing it
          is counting down is the clearer picture anyway. Rounds scored
          against a bar keep the bar in flow, full width, where it belongs.
        */}
        {questionMedia && (
          <div className="stage-media">
            {questionMedia}
            {ringOnMedia && (
              <div className="stage-clock">
                <TimerRing left={state.timeLeft} total={round.seconds!} />
              </div>
            )}
          </div>
        )}

        {showClock && !ringOnMedia && (
          barClock
            ? <TimerBar left={state.timeLeft} total={round.seconds!} />
            : <TimerRing left={state.timeLeft} total={round.seconds!} />
        )}

        {state.hintShown && q.hint && !revealed && (
          <p className="hint-box">💡 {q.hint}</p>
        )}

        {/* Type it out — harder, and worth more. */}
        {showChoices && config.answerMode === 'typed' && !revealed && (() => {
          // Whoever is up: the team whose turn it is, or the next one still to answer.
          const entering = turn ?? teams.find((t) => !state.picks[t]) ?? null;
          if (!entering) return <p className="stage-note">Both answers are in…</p>;
          return (
            <form
              className="typed-answer"
              onSubmit={(e) => {
                e.preventDefault();
                const value = typed.trim();
                if (!value) return;
                sfx.select();
                dispatch({ type: 'lock', team: entering, choice: value });
                setTyped('');
              }}
            >
              <span className="label" style={{ color: teamOf(entering).colour }}>
                {config.solo ? 'Your answer' : `${teamOf(entering).name} — type it`}
              </span>
              <div className="row gap-sm">
                <input
                  className="input grow"
                  value={typed}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Type the answer…"
                  onChange={(e) => setTyped(e.target.value)}
                  style={{ borderColor: teamOf(entering).colour }}
                />
                <button className="btn btn-gold" type="submit" disabled={!typed.trim()}>Enter</button>
              </div>
              <p className="dim" style={{ fontSize: '0.8em' }}>
                Spelling is forgiven — close enough counts.
              </p>
            </form>
          );
        })()}

        {/* Multiple choice grid — the whole interface in no-host mode. */}
        {showChoices && config.answerMode === 'choices' && (
          <div className="choices">
            {q.choices.map((choice, i) => {
              // Only after the reveal. Showing this live put a chip with the
              // team's name on the option they had chosen, which the other team
              // could simply read off the screen and copy — the whole point of
              // locking in separately was lost.
              const pickedBy = revealed
                ? teams.filter((t) => state.picks[t] === choice)
                : [];
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
                    // Rounds that belong to one team go to that team; otherwise
                    // a tap assigns to whoever has not locked in yet.
                    const team: TeamId | null = turn ?? teams.find((t) => !state.picks[t]) ?? null;
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

        {config.answerMode === 'typed' && revealed && (
          <div className="row gap-sm wrap-w" style={{ justifyContent: 'center' }}>
            {teams.map((t) => state.picks[t] && (
              <span key={t} className="pick-chip" style={{ ['--c' as string]: teamOf(t).colour }}>
                {teamOf(t).name}: {state.picks[t]}
              </span>
            ))}
          </div>
        )}

        {/* Who has answered, without saying what they answered. */}
        {lockIn && !revealed && teams.some((t) => state.picks[t]) && (
          <p className="stage-note">
            {teams.filter((t) => state.picks[t]).map((t) => (
              <b key={t} style={{ color: teamOf(t).colour }}>{teamOf(t).name} locked in. </b>
            ))}
            {teams.some((t) => !state.picks[t]) && 'Waiting…'}
          </p>
        )}

        {lockIn && !revealed && (
          <p className="stage-note">
            {config.solo ? (
              <>Press <span className="kbd">1</span>–<span className="kbd">4</span> to answer</>
            ) : turn ? (
              <><b style={{ color: teamOf(turn).colour }}>{teamOf(turn).name}</b>{"'"}s turn — press{' '}
                <span className="kbd">{turn === 'a' ? '1' : '7'}</span>–<span className="kbd">{turn === 'a' ? '4' : '0'}</span></>
            ) : (
              <>
                <b style={{ color: teamOf('a').colour }}>{teamOf('a').name}</b> presses{' '}
                <span className="kbd">1</span>–<span className="kbd">4</span> &nbsp;·&nbsp;
                <b style={{ color: teamOf('b').colour }}>{teamOf('b').name}</b> presses{' '}
                <span className="kbd">7</span>–<span className="kbd">0</span>
              </>
            )}
          </p>
        )}

        {/* Buzzers for the race rounds. */}
        {config.hosted && BUZZ_ROUNDS.includes(round.kind) && !revealed && buzzers}

        {round.kind === 'wager' && !revealed && config.hosted && (
          <div className="final-scores">
            {teams.map((id) => (
              <div key={id} className="final-card" style={{ ['--c' as string]: teamOf(id).colour, minWidth: 210 }}>
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

  /* -------------------------------------------------------- player bar */

  // Without a host there is no control bar, but two things still need a hand:
  // banking the chain, and moving on from a chain question once that call has
  // been made. Everything else the screen decides for itself.
  const playerBar = !config.hosted && round?.kind === 'chain'
    && !['game-end', 'round-intro', 'round-end'].includes(state.phase) && (
    <div className="hostbar">
      <div className="hostbar-inner">
        <span className="eyebrow" style={{ color: teamOf(state.chainTeam).colour }}>
          {config.solo ? 'Your chain' : `${teamOf(state.chainTeam).name}'s chain`}
        </span>
        <button className="btn btn-gold" disabled={state.chainPot === 0}
          onClick={() => { sfx.bank(); dispatch({ type: 'chain-bank' }); }}>
          🏦 Bank {state.chainPot || ''}
        </button>
        {state.phase === 'revealed' && (
          <button className="btn btn-gold" onClick={() => dispatch({ type: 'next' })}>
            {state.chainPot > 0 ? 'Risk it →' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  );

  /* ---------------------------------------------------------- host bar */

  const hostBar = config.hosted && !['game-end', 'round-intro', 'wager-set'].includes(state.phase) && (
    <div className="hostbar">
      <div className="hostbar-inner">
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
          <button className="btn btn-gold" onClick={() => dispatch({ type: 'next' })}>
            Next <span className="kbd">Space</span>
          </button>
        )}

        <span className="divider" />
        {teams.map((id) => (
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

  /* ------------------------------------------------------------- rail */

  const rails: RailItem[] = [
    { key: 'exit', icon: 'close', label: 'Quit the game', onGo: onExit },
    { key: 'round', icon: round ? ROUND_INFO[round.kind].emoji : 'trophy', label: round ? ROUND_INFO[round.kind].title : 'Round' },
    ...(config.hosted ? [
      {
        key: 'hint',
        icon: 'bulb',
        label: 'Show the hint',
        disabled: !(state.phase === 'question' && q?.hint && !state.hintShown),
        onGo: () => { sfx.hint(); dispatch({ type: 'hint' }); },
      },
      {
        key: 'skip',
        icon: 'skip',
        label: 'Skip this round',
        disabled: state.phase === 'game-end',
        onGo: () => dispatch({ type: 'skip-round' }),
      },
    ] : []),
  ];

  /* ------------------------------------------------------------ render */

  return (
    <Screen theme={themeVars(theme)}>
      <Hud>
        <Wordmark
          jp={theme.jp}
          en={round ? ROUND_INFO[round.kind].title : 'Quiz Arena'}
        />
        <div className="hud-right">
          <span className="hud-pill">
            Round {Math.min(state.roundIndex + 1, rounds.length)} / {rounds.length}
          </span>
          {round?.points ? <span className="hud-pill" data-on="true">{round.points} pts</span> : null}
        </div>
      </Hud>

      <Rail items={rails} active="round" />

      <div className="arena-body">
        {/* The round's name in Japanese, set into the corner. Decorative, so it
            is kept out of the accessibility tree rather than read aloud. */}
        <span className="round-jp" aria-hidden="true">{theme.jp}</span>
        {Scoreboard}
        {stage}
        {hostBar}
        {playerBar}
      </div>

      {state.banner.team && (
        <BuzzBanner
          name={teamOf(state.banner.team).name}
          colour={teamOf(state.banner.team).colour}
          nonce={state.banner.nonce}
        />
      )}
      <Verdict kind={state.fx.kind} nonce={state.fx.nonce} />
      <Toast toast={state.toast} />
      <Confetti nonce={confetti} colours={[teamOf('a').colour, teamOf('b').colour, theme.accent, '#ffffff']} />

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
    </Screen>
  );
}

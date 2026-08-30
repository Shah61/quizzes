'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  JLevel, JMode, JQuestion, LEVEL_INFO, MODE_INFO, makeQuestion, poolFor, typedIsCorrect,
} from '@/game/japanese';
import { TEAM_COLOURS } from '@/game/types';
import { primeAudio, sfx } from '@/game/sfx';
import { Confetti, TimerBar, Verdict } from './bits';

type Phase = 'setup' | 'play' | 'done';
type PlayerId = 0 | 1;

const ALL_LEVELS: JLevel[] = ['n5', 'n4', 'n3', 'n2', 'n1'];
const ALL_MODES: JMode[] = ['jp-en', 'en-jp', 'reading', 'kana', 'type'];
const KEYS: Record<PlayerId, string[]> = { 0: ['1', '2', '3', '4'], 1: ['7', '8', '9', '0'] };
const SECONDS = 20;

export default function Japanese({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [names, setNames] = useState(['Player 1', 'Player 2']);
  const [colours, setColours] = useState([TEAM_COLOURS[4], TEAM_COLOURS[0]]);
  const [levels, setLevels] = useState<JLevel[]>(['n5', 'n4', 'n3']);
  const [modes, setModes] = useState<JMode[]>(['jp-en', 'en-jp', 'reading']);
  const [total, setTotal] = useState(15);

  const [index, setIndex] = useState(0);
  const [q, setQ] = useState<JQuestion | null>(null);
  const [scores, setScores] = useState([0, 0]);
  const [streaks, setStreaks] = useState([0, 0]);
  const [locked, setLocked] = useState<PlayerId[]>([]);
  const [answered, setAnswered] = useState(false);
  const [winner, setWinner] = useState<PlayerId | null>(null);
  const [picks, setPicks] = useState<Partial<Record<PlayerId, string>>>({});
  const [typed, setTyped] = useState('');
  const [typeTurn, setTypeTurn] = useState<PlayerId>(0);
  const [typeState, setTypeState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [left, setLeft] = useState(SECONDS);
  const [fx, setFx] = useState<{ kind: 'good' | 'bad' | null; nonce: number }>({ kind: null, nonce: 0 });
  const [confetti, setConfetti] = useState(0);

  const pool = useMemo(() => poolFor(levels), [levels]);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------------ flow */

  const nextQuestion = useCallback((n: number) => {
    if (n >= total) { setPhase('done'); sfx.fanfare(); setConfetti((c) => c + 1); return; }
    const next = makeQuestion(pool, modes, n);
    setQ(next);
    setIndex(n);
    setLocked([]);
    setAnswered(false);
    setWinner(null);
    setPicks({});
    setTyped('');
    setTypeState('idle');
    setLeft(SECONDS);
    if (next.mode === 'type') setTimeout(() => inputRef.current?.focus(), 60);
  }, [pool, modes, total]);

  const begin = () => {
    if (!levels.length || !modes.length) return;
    primeAudio(); sfx.start();
    setScores([0, 0]); setStreaks([0, 0]); setPhase('play');
    nextQuestion(0);
  };

  // Countdown; running out counts as nobody scoring.
  useEffect(() => {
    if (phase !== 'play' || answered) return;
    if (left <= 0) {
      setAnswered(true);
      setFx({ kind: 'bad', nonce: Date.now() });
      sfx.timeUp();
      return;
    }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left, phase, answered]);

  // Move on shortly after an answer lands so the duel keeps pace.
  useEffect(() => {
    if (phase !== 'play' || !answered) return;
    const t = setTimeout(() => nextQuestion(index + 1), 2300);
    return () => clearTimeout(t);
  }, [answered, phase, index, nextQuestion]);

  const award = useCallback((player: PlayerId, correct: boolean) => {
    if (correct) {
      const bonus = Math.max(0, Math.round(left / 5));
      setScores((s) => { const n = [...s]; n[player] += 10 + bonus; return n; });
      setStreaks((s) => { const n = [...s]; n[player] += 1; return n; });
      setWinner(player);
      setAnswered(true);
      setFx({ kind: 'good', nonce: Date.now() });
      sfx.correct();
    } else {
      setStreaks((s) => { const n = [...s]; n[player] = 0; return n; });
      sfx.wrong();
    }
  }, [left]);

  const choose = useCallback((player: PlayerId, choice: string) => {
    if (!q || answered || locked.includes(player) || q.mode === 'type') return;
    setPicks((p) => ({ ...p, [player]: choice }));
    if (choice === q.answer) {
      award(player, true);
    } else {
      // A wrong pick locks that player out and leaves the point to the other.
      const nextLocked = [...locked, player];
      setLocked(nextLocked);
      award(player, false);
      if (nextLocked.length >= 2) { setAnswered(true); setFx({ kind: 'bad', nonce: Date.now() }); }
    }
  }, [q, answered, locked, award]);

  const submitTyped = () => {
    if (!q || answered || q.mode !== 'type') return;
    if (typedIsCorrect(typed, q)) {
      setTypeState('correct');
      award(typeTurn, true);
    } else {
      setTypeState('wrong');
      award(typeTurn, false);
      setAnswered(true);
      setFx({ kind: 'bad', nonce: Date.now() });
    }
    setTypeTurn((t) => (t === 0 ? 1 : 0));
  };

  /* ------------------------------------------------------ shortcuts */

  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !q || answered) return;
      const el = e.target as HTMLElement | null;
      if (el?.tagName === 'INPUT') return; // typing round owns the keyboard
      for (const player of [0, 1] as PlayerId[]) {
        const i = KEYS[player].indexOf(e.key);
        if (i >= 0 && q.choices[i]) { sfx.select(); choose(player, q.choices[i]); return; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, q, answered, choose]);

  // Functional update so rapid toggles cannot read a stale array.
  const toggle = <T,>(v: T, set: React.Dispatch<React.SetStateAction<T[]>>) => {
    sfx.select();
    set((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]));
  };

  /* --------------------------------------------------------- setup */

  if (phase === 'setup') {
    return (
      <div className="jp">
        <div className="jp-mark" aria-hidden>語</div>
        <div className="wrap">
          <div className="topbar">
            <button className="btn btn-ghost btn-sm" onClick={onExit}>← Back</button>
            <h2 className="display" style={{ fontSize: '1.5rem' }}>Japanese Quiz</h2>
          </div>

          <div className="setup-grid" style={{ paddingTop: 22 }}>
            <section className="panel panel-lg" style={{ padding: 24 }}>
              <p className="label" style={{ marginBottom: 16 }}>Two players, one screen</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22 }}>
                {[0, 1].map((i) => (
                  <div key={i} className="field">
                    <span className="label">
                      Player {i + 1} · keys {KEYS[i as PlayerId][0]}–{KEYS[i as PlayerId][3]}
                    </span>
                    <input
                      className="input"
                      value={names[i]}
                      maxLength={20}
                      onChange={(e) => setNames((n) => { const c = [...n]; c[i] = e.target.value; return c; })}
                      style={{ borderColor: colours[i], fontWeight: 700 }}
                    />
                    <div className="swatches">
                      {TEAM_COLOURS.map((c) => (
                        <button key={c} className="swatch" style={{ background: c }} data-on={colours[i] === c}
                          aria-label={c}
                          onClick={() => { sfx.select(); setColours((p) => { const n = [...p]; n[i] = c; return n; }); }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel panel-lg" style={{ padding: 24 }}>
              <p className="label" style={{ marginBottom: 14 }}>JLPT levels</p>
              <div className="row wrap-w gap-sm">
                {ALL_LEVELS.map((l) => (
                  <button key={l} className="chip" data-on={levels.includes(l)} onClick={() => toggle(l, setLevels)}>
                    <span className="jp-level" data-lv={l} style={{ border: 'none', background: 'none', padding: 0 }}>
                      {l.toUpperCase()}
                    </span>
                    <span>{LEVEL_INFO[l]}</span>
                  </button>
                ))}
              </div>
              <p className="muted" style={{ marginTop: 12, fontSize: '0.88em' }}>
                {pool.length.toLocaleString()} words in the selected range.
              </p>
            </section>

            <section className="panel panel-lg" style={{ padding: 24 }}>
              <p className="label" style={{ marginBottom: 14 }}>Question types</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
                {ALL_MODES.map((m) => (
                  <button key={m} className="choice" data-state={modes.includes(m) ? 'correct' : undefined}
                    onClick={() => toggle(m, setModes)} style={{ textAlign: 'left' }}>
                    <span className="choice-key">{MODE_INFO[m].emoji}</span>
                    <span>
                      <strong style={{ display: 'block' }}>{MODE_INFO[m].title}</strong>
                      <span className="muted" style={{ fontSize: '0.82em', fontWeight: 400 }}>{MODE_INFO[m].blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel panel-lg" style={{ padding: 24 }}>
              <p className="label" style={{ marginBottom: 14 }}>How many questions?</p>
              <div className="seg">
                {[10, 15, 25, 40].map((n) => (
                  <button key={n} data-on={total === n} onClick={() => { sfx.select(); setTotal(n); }}>{n}</button>
                ))}
              </div>
            </section>

            <button className="btn btn-primary btn-lg" style={{ justifySelf: 'center' }}
              onClick={begin} disabled={!levels.length || !modes.length}>
              Start the duel →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------- result */

  if (phase === 'done') {
    const champ = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
    return (
      <div className="jp">
        <div className="jp-mark" aria-hidden>勝</div>
        <div className="wrap podium">
          <p className="eyebrow">Duel over</p>
          <h1 className="winner-name display" style={{ ['--c' as string]: champ === null ? '#fff' : colours[champ] }}>
            {champ === null ? 'Dead heat' : `${names[champ]} wins`}
          </h1>
          <div className="final-scores">
            {[0, 1].map((i) => (
              <div key={i} className="final-card" style={{ ['--c' as string]: colours[i] }}>
                <div className="team-meta">{names[i]}</div>
                <div className="team-score" style={{ ['--c' as string]: colours[i] }}>{scores[i]}</div>
              </div>
            ))}
          </div>
          <div className="row gap-sm wrap-w" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary btn-lg" onClick={() => setPhase('setup')}>Run it back</button>
            <button className="btn btn-ghost" onClick={onExit}>Back to menu</button>
          </div>
        </div>
        <Confetti nonce={confetti} colours={[colours[0], colours[1], '#ffc53d', '#fff']} />
      </div>
    );
  }

  /* ------------------------------------------------------------ play */

  if (!q) return null;
  const isType = q.mode === 'type';

  return (
    <div className="jp">
      <div className="jp-mark" aria-hidden>{q.mode === 'kana' ? 'あ' : '語'}</div>

      <div className="wrap">
        <div className="scoreboard">
          {[0, 1].map((i) => (
            <div key={i} className="team-card" data-side={i === 1 ? 'b' : 'a'}
              data-locked={locked.includes(i as PlayerId)}
              data-buzzed={winner === i}
              data-active={isType && typeTurn === i}
              style={{ ['--c' as string]: colours[i] }}>
              <span className="team-dot" />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="team-name">{names[i]}</div>
                <div className="team-meta">
                  {streaks[i] > 1 ? `🔥 ${streaks[i]} in a row` : `keys ${KEYS[i as PlayerId][0]}–${KEYS[i as PlayerId][3]}`}
                </div>
              </div>
              <div className="team-score" style={{ ['--c' as string]: colours[i] }}>{scores[i]}</div>
            </div>
          ))}
          <div className="round-pill">
            <span className="round-num">{index + 1}<span className="dim">/{total}</span></span>
            <span className="round-kind">{MODE_INFO[q.mode].title}</span>
          </div>
        </div>
      </div>

      <div className="stage wrap">
        <div className="row gap-sm" style={{ justifyContent: 'center' }}>
          <span className="jp-level" data-lv={q.level}>{q.level.toUpperCase()}</span>
          <span className="category-badge">{q.ask}</span>
        </div>

        <div className={q.mode === 'en-jp' ? 'jp-english' : 'jp-word'}>{q.main}</div>
        {q.sub && !answered && q.mode !== 'reading' && <p className="jp-romaji">{q.sub}</p>}
        {q.sub && q.mode === 'reading' && <p className="muted" style={{ fontSize: '1.05em' }}>{q.sub}</p>}

        {!answered && <TimerBar left={left} total={SECONDS} />}

        {isType ? (
          <div className="stack gap center">
            <p className="eyebrow" style={{ color: colours[typeTurn] }}>{names[typeTurn]}&apos;s turn to type</p>
            <input
              ref={inputRef}
              className="jp-type-input"
              data-state={typeState === 'idle' ? undefined : typeState}
              value={typed}
              disabled={answered}
              placeholder="romaji…"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitTyped(); }}
            />
            {!answered && <button className="btn btn-primary" onClick={submitTyped}>Submit</button>}
          </div>
        ) : (
          <div className="choices">
            {q.choices.map((choice, i) => {
              const by = ([0, 1] as PlayerId[]).filter((p) => picks[p] === choice);
              const stateAttr = answered
                ? choice === q.answer ? 'correct' : by.length ? 'wrong' : 'muted'
                : by.length ? 'wrong' : undefined;
              return (
                <button key={`${q.id}-${choice}`} className="choice" data-state={stateAttr} disabled={answered}
                  onClick={() => {
                    const p: PlayerId | null = !locked.includes(0) && picks[0] === undefined ? 0
                      : !locked.includes(1) && picks[1] === undefined ? 1 : null;
                    if (p !== null) { sfx.select(); choose(p, choice); }
                  }}>
                  <span className="choice-key">{i + 1}</span>
                  <span className="grow">{choice}</span>
                  <span className="picks">
                    {by.map((p) => (
                      <span key={p} className="pick-chip" style={{ ['--c' as string]: colours[p] }}>
                        {names[p].slice(0, 8)}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {answered && (
          <div className="stack gap-sm center">
            <p className="answer-reveal display" style={{ fontSize: 'clamp(1.4rem,4vw,2.4rem)' }}>{q.reveal}</p>
            {winner !== null && <p className="muted">Point to <b style={{ color: colours[winner] }}>{names[winner]}</b></p>}
            <button className="btn btn-ghost btn-sm" onClick={() => nextQuestion(index + 1)}>Next now →</button>
          </div>
        )}

        {!answered && !isType && (
          <p className="muted" style={{ fontSize: '0.85em' }}>
            <b style={{ color: colours[0] }}>{names[0]}</b> <span className="kbd">1</span>–<span className="kbd">4</span>
            &nbsp;·&nbsp;
            <b style={{ color: colours[1] }}>{names[1]}</b> <span className="kbd">7</span>–<span className="kbd">0</span>
          </p>
        )}
      </div>

      <Verdict kind={fx.kind} nonce={fx.nonce} />
      <button className="exit-btn" onClick={onExit} aria-label="Exit to menu" title="Exit">×</button>
    </div>
  );
}

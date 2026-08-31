import type { GameConfig, Question, RoundKind, RoundSpec, TeamId } from './types';
import { ROUND_INFO, playingTeams } from './types';
import { isCorrect, questionsFor, seededRng, type Rng } from './content';

export type Phase =
  | 'round-intro'   // title card for the round
  | 'wager-set'     // teams place bets before the final question
  | 'question'      // live: buzzers armed / clock running
  | 'buzzed'        // someone buzzed, waiting on the host's verdict
  | 'revealed'      // answer on screen
  | 'round-end'     // round summary
  | 'game-end';     // podium

/** How the pot grows in The Chain. */
export const CHAIN_LADDER = [5, 10, 20, 40, 80, 160, 320, 640];

export interface State {
  config: GameConfig;
  rounds: RoundSpec[];
  roundIndex: number;
  qIndex: number;
  phase: Phase;
  scores: Record<TeamId, number>;

  buzzed: TeamId | null;
  lockedOut: TeamId[];
  hintShown: boolean;

  timeLeft: number;
  running: boolean;

  chainPot: number;
  chainTeam: TeamId;
  chainStreak: number;

  rapidTeam: TeamId;
  rapidScored: Record<TeamId, number>;
  rapidDone: TeamId[];

  wagers: Record<TeamId, number>;
  wagerResult: Partial<Record<TeamId, boolean>>;

  picks: Partial<Record<TeamId, string>>;
  pickOrder: TeamId[];

  /** Voice Battle: live tally from players voting on their own devices. */
  votes: Record<TeamId, number>;

  /** Bumped to retrigger one-shot animations. */
  fx: { kind: 'good' | 'bad' | null; nonce: number };
  banner: { team: TeamId | null; nonce: number };
  toast: { text: string; nonce: number } | null;
  scoreFx: Record<TeamId, number>;
}

export type Action =
  | { type: 'start-round' }
  | { type: 'next-round' }
  | { type: 'buzz'; team: TeamId }
  | { type: 'verdict'; team: TeamId; correct: boolean }
  | { type: 'reveal' }
  | { type: 'hint' }
  | { type: 'next' }
  | { type: 'adjust'; team: TeamId; delta: number }
  | { type: 'tick' }
  | { type: 'toggle-clock' }
  | { type: 'set-wager'; team: TeamId; amount: number }
  | { type: 'confirm-wagers' }
  | { type: 'wager-verdict'; team: TeamId; correct: boolean }
  | { type: 'lock'; team: TeamId; choice: string }
  | { type: 'rapid-mark'; correct: boolean }
  | { type: 'chain-bank' }
  | { type: 'voice-result'; team: TeamId | null }
  | { type: 'geo-result'; points: Partial<Record<TeamId, number>> }
  | { type: 'vote'; team: TeamId }
  | { type: 'clear-votes' }
  | { type: 'skip-round' }
  | { type: 'end-game' };

const OTHER = (t: TeamId): TeamId => (t === 'a' ? 'b' : 'a');

/**
 * Did this answer count?
 *
 * Typed answers go through the fuzzy matcher, which forgives spelling, spacing
 * and word order — "shingeki" takes Attack on Titan. Multiple choice must not:
 * the same matcher accepts "Naruto Shippuden" for an answer of "Naruto", so a
 * distractor that contains the answer would score. On four fixed options the
 * string is either the answer or it is not.
 */
export function answerAccepted(state: State, q: Question, pick: string | undefined): boolean {
  if (!pick) return false;
  return state.config.answerMode === 'typed' ? isCorrect(pick, q) : pick === q.answer;
}

/** Typing it out from nothing is harder than picking it off a list. */
const TYPED_BONUS = 1.5;
const awardFor = (state: State, points: number) =>
  Math.round(points * (state.config.answerMode === 'typed' ? TYPED_BONUS : 1));

/** The teams in this game — one of them in a solo run. */
export const teamsIn = (state: State): TeamId[] => playingTeams(state.config);

/**
 * Rounds that are one team at a time rather than a race.
 *
 * Rapid Fire and The Chain belong to whoever's turn it is, and that stays true
 * without a host: the other side must not be able to answer for them. Returns
 * null for rounds where everyone answers at once.
 */
export function turnTeam(state: State): TeamId | null {
  const round = currentRound(state);
  if (!round) return null;
  if (round.kind === 'rapid') return state.rapidTeam;
  if (round.kind === 'chain') return state.chainTeam;
  return null;
}

/* --------------------------------------------------------------- setup */

export function buildRounds(config: GameConfig): RoundSpec[] {
  const specs: RoundSpec[] = [];
  // A daily run is the same for everybody who plays it that day.
  const rng: Rng | undefined = config.dailySeed !== undefined ? seededRng(config.dailySeed) : undefined;
  for (const kind of config.rounds) {
    const info = ROUND_INFO[kind];
    // Rapid fire runs twice (once per team), so it needs a deeper pile.
    const need = kind === 'rapid' ? config.questionsPerRound * 6
      : kind === 'chain' ? config.questionsPerRound * 2
      : kind === 'wager' ? 1
      : config.questionsPerRound;
    const questions = questionsFor(kind, config.categories, need, config.mimicSources, rng);
    if (!questions.length) continue; // e.g. openings with no anime selected
    specs.push({ kind, title: info.title, blurb: info.blurb, points: info.points, seconds: info.seconds, questions });
  }
  return specs;
}

export function initialState(config: GameConfig, rounds: RoundSpec[]): State {
  return {
    config,
    rounds,
    roundIndex: 0,
    qIndex: 0,
    phase: 'round-intro',
    scores: { a: 0, b: 0 },
    buzzed: null,
    lockedOut: [],
    hintShown: false,
    timeLeft: 0,
    running: false,
    chainPot: 0,
    chainTeam: 'a',
    chainStreak: 0,
    rapidTeam: 'a',
    rapidScored: { a: 0, b: 0 },
    rapidDone: [],
    wagers: { a: 10, b: 10 },
    wagerResult: {},
    picks: {},
    pickOrder: [],
    votes: { a: 0, b: 0 },
    fx: { kind: null, nonce: 0 },
    banner: { team: null, nonce: 0 },
    toast: null,
    scoreFx: { a: 0, b: 0 },
  };
}

/* ------------------------------------------------------------ selectors */

export const currentRound = (s: State): RoundSpec | undefined => s.rounds[s.roundIndex];
export const currentQuestion = (s: State): Question | undefined =>
  currentRound(s)?.questions[s.qIndex];

/** Buzzing early on a timed round is worth more. */
export function pointsFor(s: State): number {
  const round = currentRound(s);
  if (!round) return 0;
  if (!round.seconds || !['reveal', 'opening', 'ending'].includes(round.kind)) return round.points;
  const speedBonus = Math.round((s.timeLeft / round.seconds) * round.points);
  return round.points + Math.max(0, speedBonus);
}

export const isTimedRound = (kind: RoundKind) => ['reveal', 'opening', 'ending', 'rapid', 'mcq'].includes(kind);

/**
 * True when the screen scores the round itself rather than a host calling it.
 * Without a host every round is answered by locking in one of four options —
 * a buzz would have nobody to adjudicate it.
 */
export function usesLockIn(state: State): boolean {
  const round = currentRound(state);
  if (!round) return false;
  // These two bring their own interface — a performance and a recording — and
  // there is nothing to pick from, host or not.
  if (['voice', 'mimic', 'geo', 'street'].includes(round.kind)) return false;
  return !state.config.hosted || round.kind === 'mcq';
}

/* -------------------------------------------------------------- reducer */

export function reducer(state: State, action: Action): State {
  const round = currentRound(state);

  switch (action.type) {
    case 'start-round': {
      if (!round) return state;
      if (round.kind === 'wager') {
        return { ...state, phase: 'wager-set', wagers: { a: 10, b: 10 }, wagerResult: {} };
      }
      // Rapid fire runs once per team. On the second turn keep the running
      // tallies and carry on through the question pile.
      const resumingRapid = round.kind === 'rapid' && state.rapidDone.length > 0;
      return {
        ...state,
        phase: 'question',
        qIndex: resumingRapid ? state.qIndex : 0,
        buzzed: null,
        lockedOut: [],
        hintShown: false,
        picks: {},
        pickOrder: [],
        votes: { a: 0, b: 0 },
        chainPot: resumingRapid ? state.chainPot : 0,
        chainStreak: resumingRapid ? state.chainStreak : 0,
        chainTeam: resumingRapid ? state.chainTeam : 'a',
        rapidTeam: resumingRapid ? state.rapidTeam : 'a',
        rapidScored: resumingRapid ? state.rapidScored : { a: 0, b: 0 },
        rapidDone: resumingRapid ? state.rapidDone : [],
        timeLeft: round.seconds ?? 0,
        running: Boolean(round.seconds),
      };
    }

    case 'buzz': {
      // Only the first team through counts, and only if they have not already tried.
      if (state.phase !== 'question' || !state.config.hosted) return state;
      if (state.buzzed || state.lockedOut.includes(action.team)) return state;
      if (round && ['rapid', 'mcq'].includes(round.kind)) return state;
      return {
        ...state,
        buzzed: action.team,
        phase: 'buzzed',
        running: false,
        banner: { team: action.team, nonce: state.banner.nonce + 1 },
      };
    }

    case 'verdict': {
      if (!round) return state;
      const { team, correct } = action;

      if (round.kind === 'chain') {
        if (correct) {
          const streak = state.chainStreak + 1;
          return {
            ...state,
            chainStreak: streak,
            chainPot: CHAIN_LADDER[Math.min(streak - 1, CHAIN_LADDER.length - 1)],
            phase: 'revealed',
            fx: { kind: 'good', nonce: state.fx.nonce + 1 },
          };
        }
        // A miss wipes the pot and hands the chain to the other team.
        return {
          ...state,
          chainStreak: 0,
          chainPot: 0,
          chainTeam: OTHER(state.chainTeam),
          phase: 'revealed',
          fx: { kind: 'bad', nonce: state.fx.nonce + 1 },
          toast: { text: 'Chain broken — the pot is gone', nonce: (state.toast?.nonce ?? 0) + 1 },
        };
      }

      if (correct) {
        const gain = pointsFor(state);
        return {
          ...state,
          scores: { ...state.scores, [team]: state.scores[team] + gain },
          scoreFx: { ...state.scoreFx, [team]: state.scoreFx[team] + 1 },
          phase: 'revealed',
          running: false,
          fx: { kind: 'good', nonce: state.fx.nonce + 1 },
          toast: { text: `+${gain} to ${state.config.teams.find((t) => t.id === team)?.name}`, nonce: (state.toast?.nonce ?? 0) + 1 },
        };
      }

      // Wrong: lock that team out. If the other side can still steal, resume.
      const lockedOut = [...state.lockedOut, team];
      const canSteal = !lockedOut.includes(OTHER(team));
      return {
        ...state,
        lockedOut,
        buzzed: null,
        phase: canSteal ? 'question' : 'revealed',
        running: canSteal ? Boolean(round.seconds) && state.timeLeft > 0 : false,
        fx: { kind: 'bad', nonce: state.fx.nonce + 1 },
        toast: canSteal
          ? { text: 'Open for the steal', nonce: (state.toast?.nonce ?? 0) + 1 }
          : state.toast,
      };
    }

    case 'vote':
      // One tap per device is not enforced; this is a party game, not an election.
      return { ...state, votes: { ...state.votes, [action.team]: state.votes[action.team] + 1 } };

    case 'clear-votes':
      return { ...state, votes: { a: 0, b: 0 } };

    case 'voice-result': {
      // Shared by Voice Battle and Mimic: one winner takes the round's points.
      if (!round || !['voice', 'mimic'].includes(round.kind)) return state;
      if (!action.team) {
        // A tie splits the points rather than awarding nothing.
        const half = Math.round(round.points / 2);
        return {
          ...state,
          scores: { a: state.scores.a + half, b: state.scores.b + half },
          scoreFx: { a: state.scoreFx.a + 1, b: state.scoreFx.b + 1 },
          phase: 'revealed',
        };
      }
      return {
        ...state,
        scores: { ...state.scores, [action.team]: state.scores[action.team] + round.points },
        scoreFx: { ...state.scoreFx, [action.team]: state.scoreFx[action.team] + 1 },
        phase: 'revealed',
        fx: { kind: 'good', nonce: state.fx.nonce + 1 },
      };
    }

    case 'geo-result': {
      // The map round scores every team on its own merits — there is no single
      // winner to award, just how close each one landed.
      const scores = { ...state.scores };
      const scoreFx = { ...state.scoreFx };
      for (const team of teamsIn(state)) {
        const gained = action.points[team] ?? 0;
        scores[team] += gained;
        if (gained > 0) scoreFx[team] += 1;
      }
      return {
        ...state,
        scores,
        scoreFx,
        phase: 'revealed',
        running: false,
        fx: { kind: Object.values(action.points).some((p) => (p ?? 0) > 0) ? 'good' : 'bad', nonce: state.fx.nonce + 1 },
      };
    }

    case 'chain-bank': {
      if (!round || round.kind !== 'chain' || state.chainPot === 0) return state;
      const team = state.chainTeam;
      return {
        ...state,
        scores: { ...state.scores, [team]: state.scores[team] + state.chainPot },
        scoreFx: { ...state.scoreFx, [team]: state.scoreFx[team] + 1 },
        chainPot: 0,
        chainStreak: 0,
        toast: { text: `Banked ${state.chainPot}!`, nonce: (state.toast?.nonce ?? 0) + 1 },
      };
    }

    case 'rapid-mark': {
      if (!round || round.kind !== 'rapid') return state;
      const team = state.rapidTeam;
      const next = state.qIndex + 1;
      if (!action.correct) {
        return { ...state, qIndex: next, hintShown: false };
      }
      return {
        ...state,
        scores: { ...state.scores, [team]: state.scores[team] + round.points },
        rapidScored: { ...state.rapidScored, [team]: state.rapidScored[team] + 1 },
        scoreFx: { ...state.scoreFx, [team]: state.scoreFx[team] + 1 },
        qIndex: next,
        hintShown: false,
      };
    }

    case 'lock': {
      if (!round || !usesLockIn(state) || state.phase !== 'question') return state;
      if (state.picks[action.team]) return state; // locked in already
      // Rapid Fire and The Chain are somebody's turn, not a free-for-all.
      const turn = turnTeam(state);
      if (turn && action.team !== turn) return state;

      const picks = { ...state.picks, [action.team]: action.choice };
      const pickOrder = [...state.pickOrder, action.team];

      // These two resolve the moment the team whose turn it is answers, rather
      // than waiting for an opponent who is not taking this question.
      if (round.kind === 'rapid') return answerRapid({ ...state, picks, pickOrder }, action.team, action.choice);
      if (round.kind === 'chain') return answerChain({ ...state, picks, pickOrder }, action.choice);

      const waitingOn = teamsIn(state).filter((t) => !picks[t]);
      if (waitingOn.length) return { ...state, picks, pickOrder };
      return scoreMcq({ ...state, picks, pickOrder });
    }

    case 'reveal': {
      if (!round) return state;
      if (usesLockIn(state) && state.phase === 'question') return scoreMcq(state);
      return { ...state, phase: 'revealed', running: false };
    }

    case 'hint':
      return { ...state, hintShown: true };

    case 'next': {
      if (!round) return state;
      const next = state.qIndex + 1;
      const last = next >= round.questions.length;
      if (last) return { ...state, phase: 'round-end', running: false };
      return {
        ...state,
        qIndex: next,
        phase: 'question',
        buzzed: null,
        lockedOut: [],
        hintShown: false,
        picks: {},
        pickOrder: [],
        wagerResult: {},
        votes: { a: 0, b: 0 },
        timeLeft: round.seconds ?? 0,
        running: Boolean(round.seconds),
      };
    }

    case 'skip-round':
      return { ...state, phase: 'round-end', running: false };

    case 'next-round': {
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.rounds.length) return { ...state, phase: 'game-end', running: false };
      return {
        ...state,
        roundIndex: nextIndex,
        qIndex: 0,
        phase: 'round-intro',
        buzzed: null,
        lockedOut: [],
        hintShown: false,
        picks: {},
        pickOrder: [],
        wagerResult: {},
        chainPot: 0,
        chainStreak: 0,
        rapidDone: [],
        rapidScored: { a: 0, b: 0 },
        timeLeft: 0,
        running: false,
      };
    }

    case 'adjust': {
      const value = Math.max(0, state.scores[action.team] + action.delta);
      return {
        ...state,
        scores: { ...state.scores, [action.team]: value },
        scoreFx: { ...state.scoreFx, [action.team]: state.scoreFx[action.team] + 1 },
      };
    }

    case 'toggle-clock':
      return { ...state, running: !state.running };

    case 'tick': {
      if (!state.running || state.timeLeft <= 0) return state;
      const timeLeft = state.timeLeft - 1;
      if (timeLeft > 0) return { ...state, timeLeft };

      // Clock hit zero — what that means depends on the round.
      if (round?.kind === 'rapid') {
        const done = [...state.rapidDone, state.rapidTeam];
        if (done.length >= teamsIn(state).length) {
          return { ...state, timeLeft: 0, running: false, phase: 'round-end', rapidDone: done };
        }
        const nextTeam = OTHER(state.rapidTeam);
        return {
          ...state,
          timeLeft: round.seconds ?? 60,
          running: false,
          rapidDone: done,
          rapidTeam: nextTeam,
          phase: 'round-intro',
        };
      }
      if (usesLockIn(state)) return scoreMcq({ ...state, timeLeft: 0, running: false });
      return { ...state, timeLeft: 0, running: false, phase: 'revealed' };
    }

    case 'set-wager': {
      const cap = Math.max(10, state.scores[action.team]);
      const amount = Math.max(0, Math.min(cap, Math.round(action.amount) || 0));
      return { ...state, wagers: { ...state.wagers, [action.team]: amount } };
    }

    case 'confirm-wagers':
      return { ...state, phase: 'question', qIndex: 0, buzzed: null, lockedOut: [], hintShown: false };

    case 'wager-verdict': {
      const { team, correct } = action;
      const bet = state.wagers[team];
      const delta = correct ? bet : -bet;
      const result = { ...state.wagerResult, [team]: correct };
      const scores = { ...state.scores, [team]: Math.max(0, state.scores[team] + delta) };
      const both = result.a !== undefined && result.b !== undefined;
      return {
        ...state,
        scores,
        wagerResult: result,
        scoreFx: { ...state.scoreFx, [team]: state.scoreFx[team] + 1 },
        phase: both ? 'revealed' : state.phase,
        fx: { kind: correct ? 'good' : 'bad', nonce: state.fx.nonce + 1 },
      };
    }

    case 'end-game':
      return { ...state, phase: 'game-end', running: false };

    default:
      return state;
  }
}

/**
 * Rapid Fire without a host: the team on the clock answers, it scores itself,
 * and the round moves straight on. No reveal — the clock is the pressure, and
 * stopping to show an answer after each one would waste the minute.
 */
function answerRapid(state: State, team: TeamId, choice: string): State {
  const round = currentRound(state);
  const q = currentQuestion(state);
  if (!round || !q) return state;
  const correct = answerAccepted(state, q, choice);
  const next = state.qIndex + 1;
  // Running out of questions ends the turn early — the pile is deep but finite.
  const exhausted = next >= round.questions.length;
  const base = {
    ...state,
    qIndex: exhausted ? state.qIndex : next,
    hintShown: false,
    picks: {},
    pickOrder: [],
    phase: (exhausted ? 'round-end' : state.phase) as State['phase'],
    running: exhausted ? false : state.running,
    fx: { kind: (correct ? 'good' : 'bad') as 'good' | 'bad', nonce: state.fx.nonce + 1 },
  };
  if (!correct) return base;
  return {
    ...base,
    scores: { ...state.scores, [team]: state.scores[team] + awardFor(state, round.points) },
    rapidScored: { ...state.rapidScored, [team]: state.rapidScored[team] + 1 },
    scoreFx: { ...state.scoreFx, [team]: state.scoreFx[team] + 1 },
  };
}

/**
 * The Chain without a host. Same ladder the host version uses: a correct answer
 * moves the pot up a rung, a wrong one wipes it and hands the chain over.
 */
function answerChain(state: State, choice: string): State {
  const q = currentQuestion(state);
  if (!q) return state;
  if (answerAccepted(state, q, choice)) {
    const streak = state.chainStreak + 1;
    return {
      ...state,
      chainStreak: streak,
      chainPot: CHAIN_LADDER[Math.min(streak - 1, CHAIN_LADDER.length - 1)],
      phase: 'revealed',
      running: false,
      fx: { kind: 'good', nonce: state.fx.nonce + 1 },
    };
  }
  const solo = state.config.solo;
  return {
    ...state,
    chainStreak: 0,
    chainPot: 0,
    // With nobody to hand it to, a solo chain just starts again.
    chainTeam: solo ? state.chainTeam : OTHER(state.chainTeam),
    phase: 'revealed',
    running: false,
    fx: { kind: 'bad', nonce: state.fx.nonce + 1 },
    toast: { text: 'Chain broken — the pot is gone', nonce: (state.toast?.nonce ?? 0) + 1 },
  };
}

/** Everyone has picked (or time ran out): score it automatically. */
function scoreMcq(state: State): State {
  const round = currentRound(state);
  const q = currentQuestion(state);
  if (!round || !q) return state;
  const teams = teamsIn(state);

  // The wager round is settled against what each team bet, not the round's
  // point value — which is zero, so scoring it the normal way awards nothing.
  if (round.kind === 'wager') {
    const scores = { ...state.scores };
    const scoreFx = { ...state.scoreFx };
    const wagerResult: Partial<Record<TeamId, boolean>> = { ...state.wagerResult };
    let anyRight = false;
    for (const team of teams) {
      const correct = answerAccepted(state, q, state.picks[team]);
      wagerResult[team] = correct;
      if (correct) anyRight = true;
      scores[team] = Math.max(0, scores[team] + (correct ? state.wagers[team] : -state.wagers[team]));
      scoreFx[team] += 1;
    }
    return {
      ...state,
      scores,
      scoreFx,
      wagerResult,
      phase: 'revealed',
      running: false,
      fx: { kind: anyRight ? 'good' : 'bad', nonce: state.fx.nonce + 1 },
    };
  }

  const scores = { ...state.scores };
  const scoreFx = { ...state.scoreFx };
  let firstCorrect: TeamId | null = null;

  for (const team of teams) {
    if (!answerAccepted(state, q, state.picks[team])) continue;
    scores[team] += awardFor(state, round.points);
    scoreFx[team] += 1;
    // Whoever locked the correct answer first takes a speed bonus.
    if (!firstCorrect && state.pickOrder.find((t) => answerAccepted(state, q, state.picks[t])) === team) {
      firstCorrect = team;
      scores[team] += 5;
    }
  }

  const anyCorrect = teams.some((t) => answerAccepted(state, q, state.picks[t]));
  return {
    ...state,
    scores,
    scoreFx,
    phase: 'revealed',
    running: false,
    fx: { kind: anyCorrect ? 'good' : 'bad', nonce: state.fx.nonce + 1 },
  };
}

export function winnerOf(state: State): TeamId | 'tie' {
  if (state.config.solo) return 'a';
  if (state.scores.a === state.scores.b) return 'tie';
  return state.scores.a > state.scores.b ? 'a' : 'b';
}

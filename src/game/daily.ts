'use client';

/**
 * The Daily Challenge.
 *
 * One fixed run per day, the same for everybody: ten questions drawn with a
 * seed made from the date, so two people who played today can compare scores
 * and mean it. A streak counts consecutive days played, which is the mechanic
 * that turns a party game you open twice into one you open every morning.
 *
 * Everything is kept in this browser. There is no server keeping score.
 */

import type { AnswerMode, Category, GameConfig, RoundKind, Team } from './types';
import { TEAM_COLOURS } from './types';

const KEY = 'quiz-arena-daily';

export interface DailyRecord {
  /** The last day played, as YYYY-MM-DD. */
  lastDay: string;
  /** Consecutive days, counting today. */
  streak: number;
  bestStreak: number;
  bestScore: number;
  /** Score on the most recent day played, so today's run can be shown back. */
  lastScore: number;
  played: number;
}

const EMPTY: DailyRecord = { lastDay: '', streak: 0, bestStreak: 0, bestScore: 0, lastScore: 0, played: 0 };

/** Local date, not UTC — the day should turn over at the player's midnight. */
export function dayKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A stable number for the day, so the same date always deals the same questions. */
export function seedFor(day = dayKey()): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function readDaily(): DailyRecord {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<DailyRecord>) };
  } catch {
    return EMPTY;
  }
}

function write(record: DailyRecord): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Blocked storage costs the streak, not the game.
  }
}

export const playedToday = (record = readDaily()) => record.lastDay === dayKey();

/** Yesterday's key, for deciding whether a streak survived. */
function previousDay(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/**
 * Record a finished run. Playing again on the same day updates the score but
 * does not inflate the streak.
 */
export function recordDaily(score: number): DailyRecord {
  const prev = readDaily();
  const today = dayKey();
  if (prev.lastDay === today) {
    const next = { ...prev, lastScore: score, bestScore: Math.max(prev.bestScore, score) };
    write(next);
    return next;
  }
  // A gap of more than one day starts again from one.
  const streak = prev.lastDay === previousDay() ? prev.streak + 1 : 1;
  const next: DailyRecord = {
    lastDay: today,
    streak,
    bestStreak: Math.max(prev.bestStreak, streak),
    bestScore: Math.max(prev.bestScore, score),
    lastScore: score,
    played: prev.played + 1,
  };
  write(next);
  return next;
}

/** Ten questions, every topic in the pot, answered however the player prefers. */
export function dailyConfig(name: string, answerMode: AnswerMode = 'choices'): GameConfig {
  const teams: [Team, Team] = [
    { id: 'a', name: name || 'You', colour: TEAM_COLOURS[4], score: 0 },
    { id: 'b', name: 'Team B', colour: TEAM_COLOURS[0], score: 0 },
  ];
  const categories: Category[] = [
    'anime', 'minecraft', 'terraria', 'marvel', 'general', 'songs', 'malaysia',
    'film', 'games', 'science', 'history', 'geography', 'sport',
  ];
  return {
    teams,
    categories,
    rounds: ['mcq'] as RoundKind[],
    hosted: false,
    solo: true,
    answerMode,
    questionsPerRound: 10,
    mimicSources: [],
    dailySeed: seedFor(),
  };
}

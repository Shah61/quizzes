import type { MimicSourceId } from './mimic-refs';

export type Category =
  | 'anime' | 'minecraft' | 'terraria' | 'marvel'
  | 'general' | 'songs' | 'malaysia';

export type RoundKind =
  | 'buzz'      // host reads a question, teams race to buzz
  | 'reveal'    // image un-blurs over time, teams race to buzz
  | 'opening'   // anime opening plays, teams race to buzz
  | 'ending'    // same, but ending themes
  | 'voice'     // Voice Battle: both teams perform a character, the room votes
  | 'mimic'     // Mimic: copy a sound, scored on melody and rhythm
  | 'rapid'     // one team, 60 seconds, as many as possible
  | 'chain'     // Weakest Link: build a streak, bank it or lose it
  | 'wager'     // final round, teams bet their points
  | 'mcq';      // multiple choice, both teams lock in — scores itself

export type TeamId = 'a' | 'b';

export interface Team {
  id: TeamId;
  name: string;
  colour: string;
  score: number;
}

export interface Question {
  id: string;
  category: Category;
  /** What the host (or screen) asks. */
  prompt: string;
  answer: string;
  /** Other spellings/orderings that should count as correct. */
  accept: string[];
  /** Four options — always present so any question can run in no-host mode. */
  choices: string[];
  hint?: string;
  /** Shown once the answer is revealed, e.g. "Attack on Titan · OP1". */
  meta?: string;
  image?: string;
  audio?: string;
  /** Second source for the audio, tried when the browser cannot play the first. */
  audioFallback?: string;
  /** Sprites need pixelated upscaling rather than smooth cover-fit. */
  sprite?: boolean;
  /** Voice Battle only: who to perform and how to play it. */
  voice?: { character: string; from: string; direction: string };
  /** Mimic only: which sound recipe to copy. */
  mimicId?: string;
  /** 1 = everyone knows it, 3 = deep cut. */
  difficulty: 1 | 2 | 3;
}

export interface RoundSpec {
  kind: RoundKind;
  title: string;
  blurb: string;
  /** Points for a correct answer in this round. */
  points: number;
  /** Seconds on the clock, if the round is timed. */
  seconds?: number;
  questions: Question[];
}

export interface GameConfig {
  teams: [Team, Team];
  categories: Category[];
  rounds: RoundKind[];
  hosted: boolean;
  questionsPerRound: number;
  /** Which pools the Mimic round draws its references from. */
  mimicSources: MimicSourceId[];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  anime: 'Anime',
  minecraft: 'Minecraft',
  terraria: 'Terraria',
  marvel: 'Marvel',
  general: 'General Knowledge',
  songs: 'Hit Songs',
  malaysia: 'Malaysia',
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  anime: '⛩️', minecraft: '⛏️', terraria: '🌳', marvel: '🦸',
  general: '🧠', songs: '🎵', malaysia: '🇲🇾',
};

export const ROUND_INFO: Record<RoundKind, { title: string; blurb: string; emoji: string; points: number; seconds?: number }> = {
  buzz:    { title: 'Buzzer Battle',  blurb: 'First team to buzz gets to answer. Wrong answer hands the steal to the other side.', emoji: '🔔', points: 10 },
  reveal:  { title: 'Pixel Reveal',   blurb: 'The picture sharpens second by second. Buzz early for more points.',                emoji: '🖼️', points: 15, seconds: 20 },
  opening: { title: 'Name That Opening', blurb: 'The anime opening plays. Buzz the moment you recognise it.',                     emoji: '🎧', points: 15, seconds: 25 },
  ending:  { title: 'Name That Ending',  blurb: 'Ending themes this time — often the harder half of the pair.',                   emoji: '🌙', points: 15, seconds: 25 },
  voice:   { title: 'Voice Battle',      blurb: 'Both teams perform the same character. Record it, play it back, and the room votes.', emoji: '🎤', points: 20 },
  mimic:   { title: 'Mimic',             blurb: 'One sound, one shot each. Scored on melody and rhythm — not on whose voice it is.', emoji: '🔊', points: 20 },
  rapid:   { title: 'Rapid Fire',     blurb: 'One team, sixty seconds, as many correct answers as possible.',                     emoji: '⚡', points: 5,  seconds: 60 },
  chain:   { title: 'The Chain',      blurb: 'Every correct answer doubles the pot. Bank it, or risk losing the lot.',            emoji: '⛓️', points: 5 },
  wager:   { title: 'Final Wager',    blurb: 'Both teams bet points before the question. Win it or lose it.',                     emoji: '💰', points: 0 },
  mcq:     { title: 'Lock It In',     blurb: 'Four options. Both teams lock an answer — the screen scores it.',                   emoji: '🎯', points: 10, seconds: 20 },
};

export const TEAM_COLOURS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
];

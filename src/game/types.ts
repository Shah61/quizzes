import type { MimicSourceId } from './mimic-refs';

export type Category =
  | 'anime' | 'minecraft' | 'terraria' | 'marvel'
  | 'general' | 'songs' | 'malaysia'
  // Added with the Open Trivia Database bank, which is deep enough in each of
  // these to stand as its own topic rather than being folded into general.
  | 'film' | 'games' | 'science' | 'history' | 'geography' | 'sport';

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
  | 'geo'       // drop a pin on the world map, scored by how close you got
  | 'street'    // dropped into a panorama somewhere on earth — where are you?
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
  /** Map round only: the place being looked for. */
  geo?: {
    lat: number; lng: number; name: string; flag?: string; capital?: string;
    /** Street View round: show the panorama and keep the name back until the reveal. */
    pano?: boolean; heading?: number; country?: string;
  };
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

/**
 * How answers are given on the self-scoring rounds.
 *
 * Four options is the friendly default. Typing it out is what the anime-music
 * crowd actually asks for — recognising a title from a list is a much smaller
 * feat than producing it from nothing — and the fuzzy matcher in content.ts
 * already forgives spelling, spacing and word order.
 */
export type AnswerMode = 'choices' | 'typed';

export interface GameConfig {
  teams: [Team, Team];
  categories: Category[];
  rounds: RoundKind[];
  hosted: boolean;
  /** One player against the questions — team B is not in the game at all. */
  solo: boolean;
  /** Tap one of four, or type it out for more points. */
  answerMode: AnswerMode;
  /** Set for the Daily Challenge: fixes the question set for the whole day. */
  dailySeed?: number;
  questionsPerRound: number;
  /** Which pools the Mimic round draws its references from. */
  mimicSources: MimicSourceId[];
}

/** The teams actually playing. Solo games have one. */
export const playingTeams = (config: Pick<GameConfig, 'solo'>): TeamId[] =>
  config.solo ? ['a'] : ['a', 'b'];

/**
 * Voice Battle is two teams performing the same character and the room voting
 * between them, so there is nothing to run solo. Everything else works alone —
 * Mimic included, because that one is scored by the machine rather than a vote.
 */
export const SOLO_ROUNDS: RoundKind[] = ['buzz', 'reveal', 'opening', 'ending', 'mimic', 'rapid', 'chain', 'mcq', 'wager', 'geo', 'street'];

export const CATEGORY_LABEL: Record<Category, string> = {
  anime: 'Anime',
  minecraft: 'Minecraft',
  terraria: 'Terraria',
  marvel: 'Marvel',
  general: 'General Knowledge',
  songs: 'Hit Songs',
  malaysia: 'Malaysia',
  film: 'Film & TV',
  games: 'Video Games',
  science: 'Science & Nature',
  history: 'History & Myth',
  geography: 'Geography',
  sport: 'Sport',
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  anime: '⛩️', minecraft: '⛏️', terraria: '🌳', marvel: '🦸',
  general: '🧠', songs: '🎵', malaysia: '🇲🇾',
  film: '🎬', games: '🎮', science: '🔬', history: '🏛️', geography: '🌍', sport: '⚽',
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
  geo:     { title: 'Where in the World', blurb: 'Drop a pin on the map. The closer you land, the more it is worth.',            emoji: '🗺️', points: 100, seconds: 30 },
  street:  { title: 'Street View',        blurb: 'You are standing somewhere on earth. Look around, then drop a pin.',          emoji: '🧭', points: 100, seconds: 60 },
  mcq:     { title: 'Lock It In',     blurb: 'Four options. Both teams lock an answer — the screen scores it.',                   emoji: '🎯', points: 10, seconds: 20 },
};

export const TEAM_COLOURS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
];

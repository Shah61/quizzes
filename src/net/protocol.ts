import type { Category, RoundKind, TeamId } from '@/game/types';

/**
 * Wire format between the host's browser (which runs the game) and every
 * player's device. The host broadcasts a full snapshot on each state change;
 * players render straight from it and send back only their intent.
 */

export const ROOM_PREFIX = 'quizarena-v2-';

/**
 * STUN alone gets through most home routers. The free TURN relay is the
 * fallback for networks that block direct peer connections (some mobile
 * carriers, office wifi) — without it those players simply cannot connect.
 */
export const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

/** What the player's screen needs in order to draw the game. */
export interface Snapshot {
  /** Coarse screen the player should show. */
  view: 'lobby' | 'round-intro' | 'question' | 'buzzed' | 'revealed' | 'round-end' | 'game-end';

  roundKind: RoundKind | null;
  roundTitle: string;
  roundBlurb: string;
  roundEmoji: string;
  roundIndex: number;
  roundTotal: number;
  qIndex: number;
  qTotal: number;

  category: Category | null;
  prompt: string;
  choices: string[];
  image: string | null;
  audio: string | null;
  audioPlaying: boolean;
  sprite: boolean;
  /** 0 = fully hidden, 1 = fully revealed. Drives the blur on picture rounds. */
  revealProgress: number;
  hint: string | null;
  meta: string | null;
  /** Only populated once the answer is out. */
  answer: string | null;

  timeLeft: number;
  seconds: number;

  teamNames: Record<TeamId, string>;
  teamColours: Record<TeamId, string>;
  scores: Record<TeamId, number>;

  buzzed: TeamId | null;
  lockedOut: TeamId[];
  picks: Partial<Record<TeamId, string>>;

  /** Whether the player's controls should be live right now. */
  canBuzz: boolean;
  canLock: boolean;
  /** True when this round is answered by choosing an option rather than buzzing;
   *  a buzzer round has no options to show, even after the reveal. */
  lockRound: boolean;

  /** Voice Battle: the performance brief, and whether voting is open. */
  voice: { character: string; from: string; direction: string } | null;
  canVote: boolean;
  votes: Record<TeamId, number>;
  hosted: boolean;

  chainPot: number;
  activeTeam: TeamId | null;
  winner: TeamId | 'tie' | null;
}

export type ToHost =
  | { type: 'join'; name: string; team: TeamId }
  | { type: 'buzz' }
  | { type: 'lock'; choice: string }
  | { type: 'vote'; team: TeamId };

export type ToPlayer =
  | { type: 'welcome'; teamNames: Record<TeamId, string>; teamColours: Record<TeamId, string> }
  | { type: 'state'; snapshot: Snapshot };

export interface Player { id: string; name: string; team: TeamId }

/**
 * The game config, parked between two routes.
 *
 * The setup screen builds a GameConfig and the arena consumes it, and they are
 * now separate pages rather than two states of one component — so the config
 * has to survive a navigation. sessionStorage rather than a URL parameter: the
 * config carries a whole team list, a category list and a round order, which is
 * a query string nobody wants to look at, and rather than localStorage because
 * a half-finished game is not something to hand back a week later.
 *
 * Nothing here is authoritative. A tab opened straight onto /game with no
 * config simply goes back to the menu.
 */

import type { GameConfig } from './types';

const KEY = 'quiz-arena:config';

export function stashConfig(config: GameConfig): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    // Private mode, or a storage quota. The push still happens; the arena
    // will find nothing and send the player back to the menu, which is a
    // better failure than a blank screen.
  }
}

export function readConfig(): GameConfig | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameConfig;
    // A config with no rounds or no teams would crash the arena's reducer on
    // the first dispatch, so treat a malformed one as no config at all.
    if (!parsed?.teams?.length || !parsed?.rounds?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearConfig(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up if it could not be written in the first place.
  }
}

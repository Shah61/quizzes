'use client';

import { CONTENT_STATS } from '@/game/content';
import { primeAudio, sfx } from '@/game/sfx';

export default function Menu({ onArena, onJapanese }: { onArena: () => void; onJapanese: () => void }) {
  const go = (fn: () => void) => () => { primeAudio(); sfx.select(); fn(); };
  const total = CONTENT_STATS.text + CONTENT_STATS.characters + CONTENT_STATS.animeTitles
    + CONTENT_STATS.openings + CONTENT_STATS.minecraft + CONTENT_STATS.terraria + CONTENT_STATS.malaysia;

  return (
    <div className="shell">
      <div className="wrap">
        <header className="menu-hero">
          <h1 className="menu-title display">QUIZ ARENA</h1>
          <p className="menu-sub">
            A two-team game show you host yourself — buzzers, pixel reveals, anime openings,
            rapid fire and a final wager. Or step aside and let the screen run the whole thing.
          </p>
          <p className="eyebrow" style={{ marginTop: 20 }}>
            {total.toLocaleString()} questions &amp; images ready to play
          </p>
        </header>

        <div className="mode-grid">
          <button className="mode-card" onClick={go(onArena)} style={{ ['--glow' as string]: 'rgba(124,92,255,0.55)' }}>
            <span className="mode-emoji">🎬</span>
            <span className="mode-name display">Team Battle</span>
            <span className="mode-desc">
              Two teams, seven rounds, one host. Anime, Minecraft, Terraria, Marvel, music,
              Malaysia and general knowledge. Play with a host calling it, or let the screen
              score everything by itself.
            </span>
            <span className="mode-tags">
              <span className="tag">2 teams</span>
              <span className="tag">7 round types</span>
              <span className="tag">Host or no host</span>
            </span>
          </button>

          <button className="mode-card" onClick={go(onJapanese)} style={{ ['--glow' as string]: 'rgba(220,38,63,0.5)' }}>
            <span className="mode-emoji">🇯🇵</span>
            <span className="mode-name display">Japanese Quiz</span>
            <span className="mode-desc">
              A head-to-head duel — no host needed. Kanji, katakana and romaji to English,
              English back to Japanese, readings, and a typing round. Every JLPT level from
              N5 to N1.
            </span>
            <span className="mode-tags">
              <span className="tag">1 v 1</span>
              <span className="tag">2,100+ words</span>
              <span className="tag">N5 → N1</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

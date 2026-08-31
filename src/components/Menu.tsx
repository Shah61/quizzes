'use client';

import { CONTENT_STATS } from '@/game/content';
import { useEffect, useState } from 'react';
import { primeAudio, sfx } from '@/game/sfx';
import { playedToday, readDaily, type DailyRecord } from '@/game/daily';

export default function Menu({ onArena, onSolo, onDaily, onJapanese }: {
  onArena: () => void; onSolo: () => void; onDaily: () => void; onJapanese: () => void;
}) {
  // Read after mount, never during render: the server has no localStorage, so
  // rendering the streak straight away made the markup disagree with itself
  // and React threw a hydration error over it.
  const [daily, setDaily] = useState<DailyRecord | null>(null);
  useEffect(() => { setDaily(readDaily()); }, []);
  const done = daily ? playedToday(daily) : false;
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
              Two teams, eleven round types, thirteen topics — anime, games, film, science,
              history, geography, sport and more. Play with a host calling it, or let the
              screen run and score the whole thing by itself.
            </span>
            <span className="mode-tags">
              <span className="tag">2 teams</span>
              <span className="tag">11 round types</span>
              <span className="tag">Host or no host</span>
            </span>
          </button>

          <button className="mode-card" onClick={go(onDaily)} style={{ ['--glow' as string]: 'rgba(255,197,61,0.55)' }}>
            <span className="mode-emoji">📅</span>
            <span className="mode-name display">Daily Challenge</span>
            <span className="mode-desc">
              Ten questions, the same ten for everyone playing today, drawn from every
              topic in the game. Come back tomorrow for ten more and keep the streak
              alive. Takes about two minutes.
            </span>
            <span className="mode-tags">
              {daily && daily.streak > 0 && <span className="tag">🔥 {daily.streak} day streak</span>}
              <span className="tag">{done ? '✓ Played today' : 'New today'}</span>
              {daily && daily.bestScore > 0 && <span className="tag">Best {daily.bestScore}</span>}
            </span>
          </button>

          <button className="mode-card" onClick={go(onSolo)} style={{ ['--glow' as string]: 'rgba(34,211,238,0.5)' }}>
            <span className="mode-emoji">🎯</span>
            <span className="mode-name display">Solo Run</span>
            <span className="mode-desc">
              Just you against the questions. Every round the screen can score by itself —
              buzzer, pixel reveal, openings, rapid fire, the chain, mimic, the world map
              and a final wager. No host, no second team, no waiting your turn.
            </span>
            <span className="mode-tags">
              <span className="tag">1 player</span>
              <span className="tag">10 round types</span>
              <span className="tag">Self-scoring</span>
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

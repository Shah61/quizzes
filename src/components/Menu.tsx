'use client';

/**
 * The home screen, built to the anatomy of the reference boards.
 *
 * A soft white ground with colour blooming through it, the cut-out character
 * standing in the middle, a floating rail of circular buttons down the left, a
 * thin top bar, and the real content in frosted glass cards anchored along the
 * bottom. The figure in the middle is the one file you supply — see game/art.ts.
 *
 * The only thing left of the old key art is the avatar: a face from the game's
 * own anime pack, greeting you by name the way the reference board does.
 */

import { useEffect, useMemo, useState } from 'react';
import { CONTENT_STATS } from '@/game/content';
import { primeAudio, sfx } from '@/game/sfx';
import { playedToday, readDaily, type DailyRecord } from '@/game/daily';
import { pickFace, type Face } from '@/game/art';
import { Cta, Hud, Icon, Rail, Screen, Wordmark, type RailItem } from './Shell';

export default function Menu({ onArena, onSolo, onDaily, onJapanese }: {
  onArena: () => void; onSolo: () => void; onDaily: () => void; onJapanese: () => void;
}) {
  const [daily, setDaily] = useState<DailyRecord | null>(null);
  const [face, setFace] = useState<Face | null>(null);
  const [active, setActive] = useState('home');

  // Both after mount: localStorage is not there on the server, and picking a
  // face at random during render would make the markup disagree with itself.
  useEffect(() => {
    setDaily(readDaily());
    setFace(pickFace());
  }, []);

  const done = daily ? playedToday(daily) : false;
  const go = (fn: () => void) => () => { primeAudio(); sfx.select(); fn(); };

  const total = useMemo(() => CONTENT_STATS.text + CONTENT_STATS.characters + CONTENT_STATS.animeTitles
    + CONTENT_STATS.openings + CONTENT_STATS.minecraft + CONTENT_STATS.terraria + CONTENT_STATS.malaysia, []);

  const rails: RailItem[] = [
    { key: 'home', icon: 'home', label: 'Home' },
    { key: 'arena', icon: 'swords', label: 'Two-team arena', onGo: go(onArena) },
    { key: 'solo', icon: 'target', label: 'Solo run', onGo: go(onSolo) },
    { key: 'daily', icon: 'daily', label: 'Daily challenge', onGo: go(onDaily) },
    { key: 'jp', icon: '語', label: 'Japanese duel', onGo: go(onJapanese) },
  ];

  return (
    <Screen>
      {/* ------------------------------------------------------- top bar */}
      <Hud>
        <Wordmark />
        <div className="hud-right">
          <span className="hud-pill">
            Hi, {face ? face.name.split(' ')[0] : 'player'}
            {face && <img className="hud-avatar" src={face.img} alt="" />}
          </span>
        </div>
      </Hud>

      {/* ----------------------------------------------------- left rail */}
      <Rail items={rails} active={active} onPick={setActive} />

      <div className="screen-main">
        {/* --------------------------------------------------- headline */}
        <div className="home-headline">
          <h1 className="home-title">
            IMMERSE IN<br />EVERY <span className="home-kanji">軍</span><br />QUIZ
          </h1>
          <p className="home-sub">
            Anime, film, games, music, science, geography — twelve kinds of round,
            for the whole room or just you.
          </p>
        </div>

        {/* ------------------------------------------------ bottom cards */}
        <div className="home-cards">
          <section className="card home-card">
            <p className="home-card-kicker">Gather the room and</p>
            <h2 className="home-card-title">ENJOY</h2>
            <Cta className="cta-wide" onClick={go(onArena)} sub="Two teams, twelve rounds">
              Let&rsquo;s explore
            </Cta>
          </section>

          <section className="card home-card home-card-stats">
            <p className="label">Ready to play</p>
            <div className="home-stat-row">
              <div className="home-stat">
                <span className="home-stat-num">{Math.round(total / 100) / 10}k</span>
                <span className="home-stat-cap">Questions</span>
              </div>
              <div className="home-stat home-stat-lift">
                <span className="home-stat-num">12</span>
                <span className="home-stat-cap">Rounds</span>
              </div>
              <div className="home-stat">
                <span className="home-stat-num">{daily?.streak ?? 0}</span>
                <span className="home-stat-cap">Streak</span>
              </div>
            </div>
            <div className="row gap-sm wrap-w" style={{ justifyContent: 'center' }}>
              <button className="chip" onClick={go(onSolo)}><Icon name="target" size={16} /> Solo run</button>
              <button className="chip" onClick={go(onJapanese)}><span className="rail-glyph" style={{ fontSize: '0.95em' }}>語</span> Japanese</button>
            </div>
          </section>

          <section className="card home-card home-card-right">
            <p className="home-card-kicker">Ten a day, then</p>
            <h2 className="home-card-title">ENJOY</h2>
            <Cta className="cta-wide" flip onClick={go(onDaily)}
              sub={done ? `Best ${daily?.bestScore ?? 0}` : 'Same ten for everyone'}>
              {done ? 'Play it again' : 'Daily challenge'}
            </Cta>
          </section>
        </div>
      </div>
    </Screen>
  );
}

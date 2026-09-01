'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GameConfig } from '@/game/types';
import Arena from '@/components/Arena';
import { readConfig } from '@/game/session';
import { Cta, Hud, Screen, Wordmark } from '@/components/Shell';

export default function GamePage() {
  const router = useRouter();
  // sessionStorage is not there on the server, so the config can only be read
  // after mount — which means this page has three states, not two: looking,
  // found, and nothing to play.
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [looked, setLooked] = useState(false);

  useEffect(() => {
    setConfig(readConfig());
    setLooked(true);
  }, []);

  if (config) {
    return (
      <Arena
        config={config}
        onExit={() => router.push(
          config.dailySeed !== undefined ? '/' : config.solo ? '/solo' : '/setup',
        )}
      />
    );
  }

  // Someone opened /game directly, or reloaded after the tab was closed. Say
  // so rather than showing an empty arena.
  return (
    <Screen>
      <Hud><Wordmark jp="クイズ" en="Quiz Arena" /></Hud>
      <div className="screen-main" style={{ paddingLeft: 'var(--gut)', justifyContent: 'center', alignItems: 'center' }}>
        <div className="round-intro">
          <h2 className="round-intro-title">{looked ? 'No game to play' : 'One moment'}</h2>
          <hr className="round-intro-rule" />
          {looked && (
            <>
              <p className="card-note" style={{ textAlign: 'center' }}>
                A game is set up before it is played, and this tab has not got one.
                Pick your teams, topics and rounds and it will start from there.
              </p>
              <Cta onClick={() => router.push('/setup')} arrow="→">Set a game up</Cta>
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}

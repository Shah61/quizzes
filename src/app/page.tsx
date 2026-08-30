'use client';

import { useState } from 'react';
import type { GameConfig } from '@/game/types';
import Menu from '@/components/Menu';
import Setup from '@/components/Setup';
import Arena from '@/components/Arena';
import Japanese from '@/components/Japanese';
import ClipStudio from '@/components/ClipStudio';
import VolumeControl from '@/components/VolumeControl';

type View = 'menu' | 'setup' | 'arena' | 'japanese' | 'studio';

export default function Page() {
  const [view, setView] = useState<View>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);

  const screen =
    view === 'japanese' ? <Japanese onExit={() => setView('menu')} />
    : view === 'studio' ? <ClipStudio onBack={() => setView('setup')} />
    : view === 'arena' && config ? <Arena config={config} onExit={() => setView('setup')} />
    : view === 'setup' ? (
      <Setup
        onBack={() => setView('menu')}
        onStudio={() => setView('studio')}
        onStart={(c) => { setConfig(c); setView('arena'); }}
      />
    )
    : <Menu onArena={() => setView('setup')} onJapanese={() => setView('japanese')} />;

  return (
    <>
      {screen}
      {/* Outside the screens so it survives every view change. The arena parks
          its own exit button in the same corner, so it shifts along there. */}
      <VolumeControl shifted={view === 'arena'} />
    </>
  );
}

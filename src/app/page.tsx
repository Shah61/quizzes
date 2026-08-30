'use client';

import { useState } from 'react';
import type { GameConfig } from '@/game/types';
import Menu from '@/components/Menu';
import Setup from '@/components/Setup';
import Arena from '@/components/Arena';
import Japanese from '@/components/Japanese';
import ClipStudio from '@/components/ClipStudio';

type View = 'menu' | 'setup' | 'arena' | 'japanese' | 'studio';

export default function Page() {
  const [view, setView] = useState<View>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);

  if (view === 'japanese') return <Japanese onExit={() => setView('menu')} />;
  if (view === 'studio') return <ClipStudio onBack={() => setView('setup')} />;
  if (view === 'arena' && config) return <Arena config={config} onExit={() => setView('setup')} />;
  if (view === 'setup') {
    return (
      <Setup
        onBack={() => setView('menu')}
        onStudio={() => setView('studio')}
        onStart={(c) => { setConfig(c); setView('arena'); }}
      />
    );
  }
  return <Menu onArena={() => setView('setup')} onJapanese={() => setView('japanese')} />;
}

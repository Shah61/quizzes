'use client';

import { useRouter } from 'next/navigation';
import Menu from '@/components/Menu';
import { dailyConfig } from '@/game/daily';
import { preloadQuestions } from '@/game/content';
import { stashConfig } from '@/game/session';

export default function HomePage() {
  const router = useRouter();
  return (
    <Menu
      onArena={() => router.push('/setup')}
      onSolo={() => router.push('/solo')}
      onJapanese={() => router.push('/japanese')}
      onDaily={() => {
        // Straight into a game from the menu, so the bank has to be here first.
        void preloadQuestions().then(() => {
          stashConfig(dailyConfig('You'));
          router.push('/game');
        });
      }}
    />
  );
}

'use client';

import { useRouter } from 'next/navigation';
import Setup from '@/components/Setup';
import { stashConfig } from '@/game/session';

export default function SoloPage() {
  const router = useRouter();
  return (
    <Setup
      solo
      onBack={() => router.push('/')}
      onStudio={() => router.push('/studio')}
      onStart={(config) => { stashConfig(config); router.push('/game'); }}
    />
  );
}

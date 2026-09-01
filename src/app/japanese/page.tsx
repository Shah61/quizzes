'use client';

import { useRouter } from 'next/navigation';
import Japanese from '@/components/Japanese';

export default function JapanesePage() {
  const router = useRouter();
  return <Japanese onExit={() => router.push('/')} />;
}

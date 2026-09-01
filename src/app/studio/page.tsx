'use client';

import { useRouter } from 'next/navigation';
import ClipStudio from '@/components/ClipStudio';

export default function StudioPage() {
  const router = useRouter();
  return <ClipStudio onBack={() => router.back()} />;
}

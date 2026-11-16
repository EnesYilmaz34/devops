'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? '/tasks' : '/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="font-mono text-sm text-moss">yükleniyor…</p>
    </div>
  );
}

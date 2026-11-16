'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, saveSession } from '@/lib/api';
import { AuthShell, FormField, PrimaryButton, ErrorNote } from '@/components/AuthShell';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, username: name } = await api.login(username, password);
      saveSession(token, name);
      router.push('/tasks');
    } catch (err) {
      setError('Kullanıcı adı veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Defter" title="Tekrar hoş geldin">
      <form onSubmit={handleSubmit}>
        {error && <ErrorNote message={error} />}
        <FormField
          label="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />
        <FormField
          label="Şifre"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="mt-6">
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </PrimaryButton>
        </div>
      </form>
      <p className="text-center text-sm text-moss mt-6 font-mono">
        Hesabın yok mu?{' '}
        <Link href="/register" className="text-clay underline underline-offset-2">
          Kayıt ol
        </Link>
      </p>
    </AuthShell>
  );
}

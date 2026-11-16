'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, saveSession } from '@/lib/api';
import { AuthShell, FormField, PrimaryButton, ErrorNote } from '@/components/AuthShell';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, username: name } = await api.register(username, email, password);
      saveSession(token, name);
      router.push('/tasks');
    } catch (err) {
      setError('Kayıt oluşturulamadı. Kullanıcı adı/e-posta zaten alınmış olabilir.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Defter" title="Yeni defter aç">
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
          label="E-posta"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormField
          label="Şifre (en az 6 karakter)"
          type="password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="mt-6">
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Oluşturuluyor…' : 'Kayıt ol'}
          </PrimaryButton>
        </div>
      </form>
      <p className="text-center text-sm text-moss mt-6 font-mono">
        Zaten hesabın var mı?{' '}
        <Link href="/login" className="text-clay underline underline-offset-2">
          Giriş yap
        </Link>
      </p>
    </AuthShell>
  );
}

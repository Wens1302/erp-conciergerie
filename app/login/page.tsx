'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);
    if (!res.ok) {
      setError('Email ou mot de passe incorrect.');
      return;
    }

    router.replace(searchParams.get('next') || '/dashboard');
    router.refresh();
  }

  return (
    <main className="login-page">
      <form className="login-box" onSubmit={submit}>
        <p className="eyebrow">Terre &amp; Mer Maroc</p>
        <h1>Connexion</h1>
        <p className="login-copy">Acces reserve a l'equipe de conciergerie.</p>

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label>Mot de passe</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className="error-box">{error}</div>}

        <button className="btn-primary login-submit" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </main>
  );
}

function LoginShell() {
  return (
    <main className="login-page">
      <div className="login-box">
        <p className="eyebrow">Terre &amp; Mer Maroc</p>
        <h1>Connexion</h1>
        <p className="login-copy">Chargement...</p>
      </div>
    </main>
  );
}

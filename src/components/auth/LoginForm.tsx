'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from '@/lib/auth-client';
import { LoginButton } from './LoginButton';

function localCallback(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) {
    return '/cut-list';
  }
  return value;
}

export function LoginForm({ developmentLoginEnabled }: { developmentLoginEnabled: boolean }) {
  const searchParams = useSearchParams();
  const callbackUrl = localCallback(searchParams.get('callbackUrl'));
  const [pending, setPending] = useState<'password' | 'google' | 'development' | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending('password');
    setError('');
    try {
      const result = await signIn.username({
        username: String(form.get('username')).trim(),
        password: String(form.get('password')),
      });
      if (result.error) {
        setError('We couldn’t log you in. Check your username and password.');
        setPending(null);
        return;
      }
      window.location.assign(callbackUrl);
    } catch {
      setError('Unable to connect. Please try again.');
      setPending(null);
    }
  }

  async function handleGoogleLogin() {
    setPending('google');
    setError('');
    try {
      const result = await signIn.social({ provider: 'google', callbackURL: callbackUrl });
      if (result.error) {
        setError('Google sign-in is unavailable. Please try another login method.');
        setPending(null);
      }
    } catch {
      setError('Unable to connect to Google. Please try again.');
      setPending(null);
    }
  }

  async function handleDevelopmentLogin() {
    setPending('development');
    setError('');
    try {
      const response = await fetch('/api/auth/sign-in/development', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Login failed');
      window.location.assign(callbackUrl);
    } catch {
      setError('Unable to start the development session. Please try again.');
      setPending(null);
    }
  }

  return (
    <>
      <form className="auth-form" onSubmit={handleSubmit} aria-busy={pending === 'password'}>
        <div className="auth-field">
          <label htmlFor="username">Username</label>
          <input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={!!pending} />
        </div>
        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required disabled={!!pending} />
        </div>
        <button type="submit" className="app-button-primary auth-submit" disabled={!!pending}>
          {pending === 'password' ? 'Logging in…' : 'Login'}
        </button>
      </form>
      <div className="auth-divider">OR</div>
      <LoginButton onClick={handleGoogleLogin} disabled={!!pending} pending={pending === 'google'} />
      {error && <p className="auth-error auth-social-error" role="alert">{error}</p>}
      {developmentLoginEnabled && (
        <button type="button" className="auth-development" onClick={handleDevelopmentLogin} disabled={!!pending}>
          {pending === 'development' ? 'Logging in…' : 'Development login'}
        </button>
      )}
    </>
  );
}

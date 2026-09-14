'use client';

import { useState } from 'react';
import { signOut } from '@/lib/auth-client';

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut() {
    setPending(true);
    setError('');
    try {
      const result = await signOut();
      if (result.error) throw new Error('Sign out failed');
      window.location.assign('/');
    } catch {
      setError('Could not sign out. Please try again.');
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" className="app-button-secondary" disabled={pending} onClick={handleSignOut}>
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <p className="mt-4 text-sm" role="alert">{error}</p>}
    </div>
  );
}

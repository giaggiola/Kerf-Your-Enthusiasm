import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { isDevelopmentLoginEnabled } from '@/lib/development';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return (
    <div className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <h1 id="login-title" className="auth-title">Login</h1>
        <Suspense fallback={<p className="auth-message" role="status">Loading…</p>}>
          <LoginForm developmentLoginEnabled={isDevelopmentLoginEnabled()} />
        </Suspense>
      </section>
    </div>
  );
}

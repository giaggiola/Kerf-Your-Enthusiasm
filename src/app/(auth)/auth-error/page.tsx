import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <div className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-error-title">
        <h1 id="auth-error-title" className="auth-title">Login failed.</h1>
        <p className="auth-message">We couldn’t sign you in. Please try again or use another login method.</p>
        <div className="auth-actions">
          <Link href="/login" className="app-button-primary">Try again</Link>
          <Link href="/">Back home</Link>
        </div>
      </section>
    </div>
  );
}

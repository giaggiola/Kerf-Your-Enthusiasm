import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { SignOutButton } from '@/components/auth/SignOutButton';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login?callbackUrl=/settings');

  return (
    <div className="settings-page">
      <h1 className="settings-title">Settings</h1>
      <section className="settings-section" aria-labelledby="account-heading">
        <h2 id="account-heading">Account</h2>
        <dl className="settings-account">
          <div><dt>Name</dt><dd>{session.user.name || '—'}</dd></div>
          <div><dt>Email</dt><dd>{session.user.email}</dd></div>
        </dl>
        <SignOutButton />
      </section>
      <section className="settings-section" aria-labelledby="about-heading">
        <h2 id="about-heading">About Kerf</h2>
        <div className="settings-links">
          <Link href="/privacy">Privacy</Link>
          <a href="https://github.com/giaggiola/Kerf-Your-Enthusiasm" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://github.com/giaggiola/Kerf-Your-Enthusiasm/issues" target="_blank" rel="noopener noreferrer">Feedback</a>
        </div>
      </section>
    </div>
  );
}

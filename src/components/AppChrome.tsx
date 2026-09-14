'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { MigrationPrompt } from '@/components/migration/MigrationPrompt';

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicPage = ['/', '/login', '/auth-error'].includes(pathname);
  const isWorkspace = /^\/projects\/[^/]+\/(?:step|layout)$/.test(pathname);

  if (isPublicPage) {
    return (
      <div className="public-shell">
        <header className="public-header">
          {pathname !== '/' && <Link href="/" className="public-home" aria-label="Kerf home">Kerf</Link>}
          <nav className="public-nav" aria-label="Account">
            <Link href="/login" aria-current={pathname === '/login' ? 'page' : undefined}>Login</Link>
            <button type="button" disabled title="Signup is not available yet">Signup</button>
          </nav>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a className="app-skip-link" href="#app-content">Skip to content</a>
      <Navigation />
      <main id="app-content" className="app-main" tabIndex={-1}>
        <div className={isWorkspace ? 'app-content app-content--workspace' : 'app-content'}>
          {children}
        </div>
      </main>
      <MigrationPrompt />
    </div>
  );
}

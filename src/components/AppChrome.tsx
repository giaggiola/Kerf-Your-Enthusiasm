'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Navigation } from '@/components/Navigation';

function KerfMark() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className="h-9 w-9">
      <rect width="36" height="36" rx="10" fill="#1d2924" />
      <path d="M11 9.5v17M25 9.5 14.5 18 25 26.5" fill="none" stroke="#fffaf4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6.5v4M18 25.5v4" stroke="#e57845" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWorkspace = /^\/projects\/[^/]+(?:\/step)?$/.test(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="app-header sticky top-0 z-40 border-b border-[var(--line)] bg-[color:var(--paper)]/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] w-full max-w-[1600px] items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label="Kerf home">
            <KerfMark />
            <div className="hidden sm:block">
              <div className="font-semibold leading-none tracking-[-0.03em] text-[var(--ink)]">
                Kerf
              </div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                Cut planning studio
              </div>
            </div>
          </Link>
          <div className="h-7 w-px bg-[var(--line)]" />
          <Navigation />
        </div>
      </header>

      <main
        className={
          isWorkspace
            ? 'min-h-0 flex-1'
            : 'mx-auto w-full max-w-[1440px] flex-1 px-4 pb-12 sm:px-6 lg:px-8'
        }
      >
        {children}
      </main>

      {!isWorkspace && (
        <footer className="border-t border-[var(--line)] bg-[var(--paper)] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1376px] flex-wrap items-center justify-between gap-4 text-xs text-[var(--muted)]">
            <span>Measure twice. Optimize once.</span>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="transition-colors hover:text-[var(--ink)]">
                Privacy
              </Link>
              <a
                href="https://github.com/nmacchitella/Kerf-Your-Enthusiasm/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-[var(--ink)]"
              >
                Feedback
              </a>
              <a
                href="https://github.com/nmacchitella/Kerf-Your-Enthusiasm"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-[var(--ink)]"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

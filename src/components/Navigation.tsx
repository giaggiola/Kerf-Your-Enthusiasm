'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { UserMenu } from '@/components/auth/UserMenu';

const publicNavItems = [
  { href: '/cut-list', label: 'Quick optimize', shortLabel: 'Optimize' },
  { href: '/calculators', label: 'Shop math', shortLabel: 'Math' },
];

const authNavItems = [
  { href: '/dashboard', label: 'Projects', shortLabel: 'Projects' },
];

export function Navigation() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  const navItems = (!isPending && session) ? [...authNavItems, ...publicNavItems] : publicNavItems;

  return (
    <nav className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {navItems.map(({ href, label, shortLabel }) => {
          const isActive =
            pathname === href ||
            (pathname === '/' && href === '/cut-list') ||
            (pathname.startsWith('/projects') && href === '/dashboard');
          return (
            <Link
              key={href}
              href={href}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-dark)]'
                  : 'text-[var(--muted)] hover:bg-black/[0.035] hover:text-[var(--ink)]'
              }`}
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="shrink-0">
        {isPending ? (
          <div className="h-9 w-9 animate-pulse rounded-full bg-black/10" />
        ) : session ? (
          <UserMenu />
        ) : (
          <Link
            href="/login"
            className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[#c8ccc5] hover:bg-[#f7f6f2]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">Sign in</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

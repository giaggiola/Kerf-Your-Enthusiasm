'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const items = [
  { href: '/cut-list', label: 'Cut lists', icon: <><path d="M8 5h12M8 12h12M8 19h12" /><path d="M3 5h1M3 12h1M3 19h1" /></> },
  { href: '/calculators', label: 'Calculators', icon: <path d="M5 3h14v18H5zM8 7h8M8 11h2m4 0h2m-8 4h2m4 0h2m-8 3h2m4 0h2" /> },
];

function NavIcon({ children }: { children: ReactNode }) {
  return <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">{children}</svg>;
}

export function Navigation() {
  const pathname = usePathname();
  return (
    <aside className="app-sidebar" aria-label="Sidebar">
      <Link href="/" className="sidebar-brand" aria-label="Kerf home">
        <span className="sidebar-brand-full">Kerf</span>
        <span className="sidebar-brand-short" aria-hidden="true">K</span>
      </Link>
      <nav className="sidebar-navigation" aria-label="Main navigation">
        <div className="sidebar-links">
          {items.map(({ href, label, icon }) => {
            const active = pathname === href || (href === '/cut-list' && (pathname.startsWith('/projects/') || pathname.startsWith('/cut-list/') || pathname === '/dashboard'));
            return (
              <Link key={href} href={href} className="sidebar-link" aria-label={label} aria-current={active ? 'page' : undefined}>
                <NavIcon>{icon}</NavIcon>
                <span className="sidebar-label">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="sidebar-bottom">
          <Link href="/settings" className="sidebar-link" aria-label="Settings" aria-current={pathname === '/settings' ? 'page' : undefined}>
            <NavIcon><path d="M4 7h16M4 17h16M9 4v6m6 4v6" /></NavIcon>
            <span className="sidebar-label">Settings</span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}

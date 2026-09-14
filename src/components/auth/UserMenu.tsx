'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signOut, useSession } from '@/lib/auth-client';

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isPending) {
    return <div className="w-8 h-8 rounded-none bg-slate-200 animate-pulse" />;
  }

  if (!session) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-none p-1 transition-colors hover:bg-black/[0.04]"
      >
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || 'User'}
            width={32}
            height={32}
            className="w-8 h-8 rounded-none"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-none bg-[var(--ink)] text-sm font-medium text-white">
            {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-[var(--line)] bg-white p-1.5 shadow-xl">
          <div className="mb-1 border-b border-[var(--line)] px-3 py-2">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">
              {session.user.name}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {session.user.email}
            </p>
          </div>

          <Link
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)] hover:bg-black/[0.04]"
          >
            Projects
          </Link>

          <button
            onClick={handleSignOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-black/[0.04]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

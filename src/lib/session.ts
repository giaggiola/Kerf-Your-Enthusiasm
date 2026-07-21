import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { isEmailAllowed } from '@/lib/allowed-emails';

export interface AppSession {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

/**
 * The single authorization gate for every server route.
 *
 * Returns null when there is no valid session OR when the signed-in address is
 * not on the allowlist. Checking the allowlist here as well as at sign-up means
 * removing an address from ALLOWED_EMAILS locks out an already-created account
 * on its next request, without having to delete the user row.
 */
export async function getSession(): Promise<AppSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.email) return null;
  if (!isEmailAllowed(session.user.email)) return null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
    },
  };
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

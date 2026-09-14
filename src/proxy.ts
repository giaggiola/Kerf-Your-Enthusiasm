import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * UX-only redirect for the signed-in pages.
 *
 * This only checks that a session cookie is PRESENT; it does not validate the
 * signature or the allowlist. It is not a security boundary. Real authorization
 * happens in `getSession()`, which every /api/v1 handler calls; this just saves
 * a signed-out visitor from landing on a page that would only render errors.
 *
 * The calculators, cut-list optimizer, and home page stay public on purpose:
 * they run entirely in the browser against localStorage and never touch the
 * server. Add them to the matcher below to lock the whole site down.
 *
 * Previous behaviour (disabled, not deleted): auth bypassed for local
 * development — all routes open.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/projects', '/settings'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (getSessionCookie(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*', '/settings/:path*'],
};

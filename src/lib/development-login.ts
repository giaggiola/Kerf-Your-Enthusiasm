import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { DEVELOPMENT_EMAIL, isDevelopmentLoginEnabled } from './development';

export function developmentLogin() {
  return {
    id: 'development-login',
    endpoints: {
      signInDevelopment: createAuthEndpoint('/sign-in/development', {
        method: 'POST',
      }, async (ctx) => {
        if (!isDevelopmentLoginEnabled()) {
          throw new APIError('NOT_FOUND');
        }

        // A browser must explicitly POST from this app's origin.
        const origin = ctx.headers?.get('origin');
        if (!origin || origin !== new URL(ctx.context.baseURL).origin) {
          throw new APIError('FORBIDDEN', { message: 'Invalid origin.' });
        }

        const adapter = ctx.context.internalAdapter;
        const existing = await adapter.findUserByEmail(DEVELOPMENT_EMAIL);
        const user = existing?.user ?? await adapter.createUser({
          name: 'Development',
          email: DEVELOPMENT_EMAIL,
          emailVerified: true,
        });
        const session = await adapter.createSession(user.id, true);
        await setSessionCookie(ctx, { user, session }, true);
        return ctx.json({ success: true });
      }),
    },
  } satisfies BetterAuthPlugin;
}

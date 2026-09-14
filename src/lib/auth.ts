import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { username } from 'better-auth/plugins';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { isEmailAllowed } from '@/lib/allowed-emails';
import { developmentLogin } from '@/lib/development-login';
import { isDevelopmentLoginEnabled } from '@/lib/development';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  plugins: [username(), ...(isDevelopmentLoginEnabled() ? [developmentLogin()] : [])],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      disableSignUp: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Refuse to create an account for anyone off the allowlist, so a
        // stranger's Google sign-in never leaves a user row behind. Throwing
        // hands off to onAPIError below, which redirects to /auth-error.
        before: async (user) => {
          if (!isEmailAllowed(user.email)) {
            throw new APIError('FORBIDDEN', {
              message: 'This account is not allowed to sign in.',
            });
          }
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ],
  // `pages: { error }` is a NextAuth option — Better-Auth ignores it silently,
  // so rejected sign-ins were landing on its built-in /api/auth/error page
  // instead of the app's. onAPIError.errorURL is the equivalent it honours.
  onAPIError: {
    errorURL: '/auth-error',
  },
});

export type Session = typeof auth.$Infer.Session;

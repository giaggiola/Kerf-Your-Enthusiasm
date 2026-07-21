import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { isEmailAllowed } from '@/lib/allowed-emails';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Refuse to create an account for anyone off the allowlist, so a
        // stranger's Google sign-in never leaves a user row behind. Throwing
        // sends them to the error page (see `pages.error`) instead of a 500.
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
  pages: {
    error: '/auth-error',
  },
});

export type Session = typeof auth.$Infer.Session;

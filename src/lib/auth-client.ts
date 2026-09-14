'use client';

import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  // Use empty string to default to current origin (works in all environments)
  baseURL: '',
  plugins: [usernameClient()],
});

export const { signIn, signOut, useSession } = authClient;

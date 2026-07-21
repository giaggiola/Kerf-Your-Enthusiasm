/**
 * DISABLED — local dev bypass that returned a hardcoded session so no login was
 * needed. Every /api/v1 route used to call this, which meant anyone who could
 * reach the app could read and write all data. Routes now use `getSession()`
 * from '@/lib/session' (real Better-Auth session + ALLOWED_EMAILS allowlist).
 *
 * Kept here, commented out, in case the no-login local workflow is wanted back.
 * DEV_USER_ID is still exported because the 'dev-local' user row seeded in
 * db/index.ts may own projects and tools created before the switch.
 */
export const DEV_USER_ID = 'dev-local';

// export function getDevSession() {
//   return {
//     user: {
//       id: DEV_USER_ID,
//       name: 'Dev',
//       email: 'dev@localhost',
//     },
//   };
// }

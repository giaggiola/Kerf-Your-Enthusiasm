/**
 * Access allowlist.
 *
 * ALLOWED_EMAILS is a comma-separated list of the Google accounts permitted to
 * sign in — the same gate eilish-ops and eilish-leads use.
 *
 * Deliberately fails CLOSED in production: if the env var is missing, nobody is
 * allowed in. A misconfigured deploy should lock the app, never silently open
 * it to the internet. Outside production an unset list allows any authenticated
 * user, so `npm run dev` still works without extra setup.
 */
const RAW_ALLOWED_EMAILS = process.env.ALLOWED_EMAILS ?? '';

const ALLOWED_EMAILS = new Set(
  RAW_ALLOWED_EMAILS.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;

  if (ALLOWED_EMAILS.size === 0) {
    return process.env.NODE_ENV !== 'production';
  }

  return ALLOWED_EMAILS.has(email.toLowerCase());
}

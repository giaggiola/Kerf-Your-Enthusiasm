export const DEVELOPMENT_EMAIL = 'dev@localhost';

export function isDevelopmentLoginEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_LOGIN === 'true';
}

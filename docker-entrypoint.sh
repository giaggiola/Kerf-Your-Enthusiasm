#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must point to the Coolify-managed PostgreSQL database}"

echo "[entrypoint] applying PostgreSQL migrations"
node scripts/migrate.mjs

echo "[entrypoint] starting Next.js"
exec node server.js

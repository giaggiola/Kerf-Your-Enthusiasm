#!/bin/sh
set -e

DB_PATH="${DATABASE_PATH:-/data/app.db}"

# The SQLite file lives on a mounted volume, so the schema cannot be baked into
# the image — it has to be applied at boot. `drizzle-kit push` diffs
# src/db/schema.ts against the live database and applies only the difference,
# which covers both a brand-new empty volume (no tables at all) and a schema
# change on an existing one.
#
# --force skips the interactive confirmation. That is safe here because every
# column the app creates at runtime in src/db/index.ts is also declared in
# schema.ts, so the diff never contains a destructive statement. Adding a column
# to the database WITHOUT adding it to schema.ts would make push drop it.
echo "[entrypoint] applying schema to ${DB_PATH}"
mkdir -p "$(dirname "${DB_PATH}")"

if ! node node_modules/drizzle-kit/bin.cjs push --force; then
  echo "[entrypoint] FATAL: schema push failed — refusing to start with an unknown schema" >&2
  exit 1
fi

echo "[entrypoint] starting Next.js"
exec node server.js

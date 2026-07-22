# ── Stage 1: install JS deps ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
# Retried because the Alpine CDN intermittently fails to serve the package index
# from this host: a single I/O error fetching APKINDEX makes apk report every
# package as "no such package" and kills the build. That failed a deploy on
# 2026-07-22 which then succeeded unchanged on retry.
RUN for attempt in 1 2 3; do \
      apk add --no-cache libc6-compat python3 make g++ && exit 0; \
      echo "apk add failed (attempt ${attempt}/3); retrying in 10s"; \
      sleep 10; \
    done; \
    echo "apk add failed after 3 attempts" >&2; exit 1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build Next.js ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Placeholders so the build succeeds — real values are injected at runtime.
# The secret must be at least 32 characters or Better-Auth throws while Next is
# collecting page data. It is deliberately not a real secret: an ENV here would
# be baked into the image, and it also shadows the build ARG Coolify injects.
ENV BETTER_AUTH_SECRET=build-time-placeholder-not-a-real-secret
ENV DATABASE_PATH=/data/app.db

# Next evaluates every route module to collect page data, and those modules
# import src/db, which opens DATABASE_PATH at import time. The directory has to
# exist for the build to get that far — this throwaway copy is not the one the
# app runs against; that lives on the volume mounted at /data.
RUN mkdir -p /data && npm run build

# ── Stage 3: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

# Standalone output + static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Drizzle schema + runtime deps for the boot-time schema push.
# drizzle-kit reads the TypeScript config and schema through esbuild, and npm
# hoists those to the top-level node_modules — copying drizzle-kit alone leaves
# it unable to resolve them, so its dependency tree comes along explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/src/db              ./src/db
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts   ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-kit  ./node_modules/drizzle-kit
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm  ./node_modules/drizzle-orm
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/esbuild         ./node_modules/esbuild
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@esbuild        ./node_modules/@esbuild
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/esbuild-register ./node_modules/esbuild-register
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@esbuild-kit    ./node_modules/@esbuild-kit
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@drizzle-team   ./node_modules/@drizzle-team

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# The SQLite file and uploaded STEP files both live under /data, which is a
# mounted volume in every deployment. Creating it here with the right owner is
# what lets an empty named volume come up writable for the unprivileged user.
RUN mkdir -p /data/step-files && chown -R nextjs:nodejs /data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_PATH=/data/app.db
ENV STEP_STORAGE_DIR=/data/step-files

CMD ["./docker-entrypoint.sh"]

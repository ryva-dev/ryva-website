# Ryva — production container (multi-stage).
# Stage 1 builds the frontend and installs deps; stage 2 is a lean runtime.

# ---------- build stage ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Build toolchain for native modules (better-sqlite3) in case a prebuilt binary
# isn't available for this platform.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
# tsc -b && vite build -> ./dist
RUN npm run build

# ---------- runtime stage ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0

# dumb-init gives us a real PID 1 so SIGTERM reaches Node and the app's graceful
# shutdown runs (drains requests, stops the scheduler).
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev \
  && apt-get purge -y python3 make g++ || true \
  && npm cache clean --force

# App code + built assets. No source .env, no dev SQLite db (see .dockerignore).
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts ./scripts
COPY data/workers.json ./data/workers.json

# Writable storage for SQLite dev / uploads. In production prefer DATABASE_URL
# (Postgres) + object storage and mount this only if you need local files.
RUN mkdir -p /app/data && chown -R node:node /app/data \
  && chmod +x /app/scripts/docker-entrypoint.sh
USER node

EXPOSE 8787

# Container-level liveness; the app also exposes /readyz for DB readiness.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]

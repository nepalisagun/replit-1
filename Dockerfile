# =============================================================================
# Nexus Agent — Multi-stage Dockerfile
#
# Stages:
#   builder  — installs all deps, builds API bundle + Vite static frontend
#   api      — slim Node runner with full workspace (needed for drizzle-kit)
#   web      — nginx serving the static frontend + proxying /api
#
# NOTE: pnpm-workspace.yaml pins esbuild/rollup/tailwind to linux-x64 binaries
# only. If building on arm64 (Apple Silicon, Graviton), comment out or adjust
# the non-linux-x64 overrides in pnpm-workspace.yaml before building.
# =============================================================================

# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN npm install -g pnpm@10.26.1

WORKDIR /workspace

# Copy manifests first for better layer caching.
# Each package.json is copied explicitly so that `pnpm install` is re-run only
# when a manifest changes, not every source file change.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/api-spec/package.json         lib/api-spec/
COPY lib/api-zod/package.json          lib/api-zod/
COPY lib/db/package.json               lib/db/
COPY lib/integrations-gemini-ai/package.json lib/integrations-gemini-ai/

# lib/integrations/* sub-packages
COPY lib/integrations/ lib/integrations/

COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/agent/package.json       artifacts/agent/
COPY scripts/package.json              scripts/

RUN pnpm install --frozen-lockfile

# Copy full source after install so the above layers are cached
COPY . .

# Build the Express API (esbuild → artifacts/api-server/dist/)
RUN pnpm --filter @workspace/api-server run build

# Build the Vite frontend (→ artifacts/agent/dist/public/)
# PORT is required by vite.config.ts but not used in static build output.
# BASE_PATH=/ so the app is served from the root (not a sub-path like on Replit).
ENV PORT=3000 \
    BASE_PATH=/ \
    NODE_ENV=production
RUN pnpm --filter @workspace/agent run build


# ── Stage 2: api ─────────────────────────────────────────────────────────────
FROM node:20-slim AS api

RUN npm install -g pnpm@10.26.1

WORKDIR /app

# Copy full workspace (source + node_modules) so drizzle-kit can read the
# TypeScript schema files at startup to run migrations.
COPY --from=builder /workspace/node_modules            ./node_modules
COPY --from=builder /workspace/pnpm-workspace.yaml     ./pnpm-workspace.yaml
COPY --from=builder /workspace/package.json            ./package.json

COPY --from=builder /workspace/lib                     ./lib
COPY --from=builder /workspace/artifacts/api-server    ./artifacts/api-server

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV PORT=8080 \
    NODE_ENV=production

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]


# ── Stage 3: web (nginx + static frontend) ───────────────────────────────────
FROM nginx:1.27-alpine AS web

COPY --from=builder /workspace/artifacts/agent/dist/public /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

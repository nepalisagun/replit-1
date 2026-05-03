#!/bin/sh
set -e

echo "==> Waiting for database to be ready..."
# Retry loop — db container is healthy before this runs, but a brief
# extra wait prevents rare timing issues on first boot.
until node -e "
  const { Client } = require('/app/node_modules/pg/lib/index.js');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "    database not ready yet, retrying in 2s..."
  sleep 2
done
echo "    database is ready."

echo "==> Running database migrations (drizzle-kit push)..."
pnpm --filter @workspace/db run push --force
echo "    migrations complete."

echo "==> Starting API server on port ${PORT}..."
exec "$@"

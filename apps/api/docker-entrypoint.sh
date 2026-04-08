#!/bin/sh
set -e

echo "🗄️  Running database migrations..."
bun /app/apps/api/src/migrate.ts

echo "🚀  Starting API server..."
exec bun /app/apps/api/src/index.ts

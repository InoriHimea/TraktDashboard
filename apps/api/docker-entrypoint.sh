#!/bin/sh
set -e

echo "🗄️  Running database migrations..."
cd /app/apps/api
bun src/migrate.ts

echo "🚀  Starting API server..."
exec bun dist/index.js

#!/bin/bash
set -e

echo "=== BeamMeUp Backend Startup ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo ""
echo "=== Running Prisma migrations ==="
npx prisma migrate deploy || {
  echo "ERROR: Migration failed!"
  exit 1
}

echo ""
echo "=== Database schema applied successfully ==="

echo ""
echo "=== Starting application ==="
exec node dist/index.js

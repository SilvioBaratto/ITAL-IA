#!/bin/sh
set -e

echo "Starting NestJS API (Supabase)..."

# Generate Prisma client (needed when source is volume-mounted in dev)
# Allow failure when prisma binary download is blocked by network/TLS
echo "Generating Prisma client..."
npx prisma generate || echo "Prisma generate failed (non-fatal in dev); using pre-generated client"

# Run Prisma migrations against hosted Supabase DB
# Allow failure when database is unreachable (e.g. local/CI environments without Supabase)
echo "Running database migrations..."
npx prisma migrate deploy && echo "Migrations completed!" || echo "Prisma migrate deploy failed (non-fatal in dev); continuing"

echo "Setup complete! Starting application..."

# Execute the main command
exec "$@"

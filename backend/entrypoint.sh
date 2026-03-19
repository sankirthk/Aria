#!/bin/sh
set -e

echo "Starting backend container..."

# Wait for Postgres to become ready
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\):.*|\1|p')
until nc -z "$DB_HOST" 5432; do
  echo "Waiting for Postgres..."
  sleep 2
done

echo "Postgres is ready."

# Ensure Prisma is initialized
if [ ! -d "prisma" ]; then
  echo "Error: prisma directory not found. Exiting."
  exit 1
fi

# Check if migrations folder exists and is not empty
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations)" ]; then
  echo "Existing migrations found. Running migrate deploy..."
  npx prisma migrate deploy
else
  echo "No migrations found."
  echo "Running 'prisma migrate dev --name init' to create the first migration..."
  
  npx prisma migrate dev --name init --skip-seed || {
    echo "migrate dev failed — falling back to 'prisma db push'..."
    npx prisma db push
  }
fi

# Build TypeScript before starting (optional: skip in dev if using tsx)
echo "Generating Prisma client..."
npx prisma generate
echo "Starting server..."
npx tsx src/server.ts

#!/bin/sh
set -e

# ---- Wait for MySQL to be available ----
DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
MAX_RETRIES="${DB_WAIT_RETRIES:-30}"
RETRY_INTERVAL="${DB_WAIT_INTERVAL:-2}"

echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."

i=0
while ! nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: MySQL is not available after ${MAX_RETRIES} retries. Exiting."
    exit 1
  fi
  echo "  Attempt ${i}/${MAX_RETRIES} — retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "MySQL is available."

# ---- Run Prisma migrations ----
echo "Running prisma migrate deploy..."
npx prisma migrate deploy

if [ $? -ne 0 ]; then
  echo "ERROR: Prisma migrate deploy failed. Exiting."
  exit 1
fi

echo "Migrations applied successfully."

# ---- Start the application ----
echo "Starting backend server..."
exec node dist/index.js

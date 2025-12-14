#!/bin/bash
set -e

echo "=============================="
echo " Running DB setup (schema + seed)"
echo "=============================="

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

echo "▶ Applying schema.sql"
psql "$DATABASE_URL" -f schema.sql

echo "▶ Applying seed-data.sql"
psql "$DATABASE_URL" -f seed-data.sql

echo "✅ DB setup finished successfully"

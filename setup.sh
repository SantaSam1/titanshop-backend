#!/bin/bash
set -e

echo "Running DB migrations..."

psql "$DATABASE_URL" < schema.sql
psql "$DATABASE_URL" < seed-data.sql

echo "DB setup finished"

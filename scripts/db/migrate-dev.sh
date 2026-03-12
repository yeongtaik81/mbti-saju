#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[error] DATABASE_URL is not set. configure .env first." >&2
  exit 1
fi

MIGRATION_NAME="${1:-init}"

echo "[db:migrate:dev] prisma generate"
pnpm prisma:generate

echo "[db:migrate:dev] prisma migrate dev --name ${MIGRATION_NAME}"
pnpm prisma:migrate --name "$MIGRATION_NAME"

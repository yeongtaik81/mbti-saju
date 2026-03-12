#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[error] required command not found: $cmd" >&2
    exit 1
  fi
}

escape_sql_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

escape_sql_identifier() {
  printf "%s" "$1" | sed 's/"/""/g'
}

require_command psql

: "${DB_ADMIN_URL:=postgresql://localhost:5432/postgres}"
: "${DB_APP_HOST:=localhost}"
: "${DB_APP_PORT:=5432}"
: "${DB_APP_DB:=mbti_saju}"
: "${DB_APP_USER:=mbti_user}"
: "${DB_APP_PASSWORD:=mbti_pass}"
: "${DB_APP_SCHEMA:=public}"

if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="postgresql://${DB_APP_USER}:${DB_APP_PASSWORD}@${DB_APP_HOST}:${DB_APP_PORT}/${DB_APP_DB}?schema=${DB_APP_SCHEMA}"
fi

app_user_literal="$(escape_sql_literal "$DB_APP_USER")"
app_db_literal="$(escape_sql_literal "$DB_APP_DB")"
app_pass_literal="$(escape_sql_literal "$DB_APP_PASSWORD")"
app_user_ident="$(escape_sql_identifier "$DB_APP_USER")"
app_db_ident="$(escape_sql_identifier "$DB_APP_DB")"
app_schema_ident="$(escape_sql_identifier "$DB_APP_SCHEMA")"

role_exists="$(psql "$DB_ADMIN_URL" -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${app_user_literal}';" | tr -d '[:space:]')"
if [ "$role_exists" != "1" ]; then
  echo "[db:init] creating role: $DB_APP_USER"
  psql "$DB_ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE ROLE \"${app_user_ident}\" LOGIN PASSWORD '${app_pass_literal}';"
else
  echo "[db:init] role already exists, rotating password: $DB_APP_USER"
  psql "$DB_ADMIN_URL" -v ON_ERROR_STOP=1 -c "ALTER ROLE \"${app_user_ident}\" LOGIN PASSWORD '${app_pass_literal}';"
fi

db_exists="$(psql "$DB_ADMIN_URL" -tAc "SELECT 1 FROM pg_database WHERE datname = '${app_db_literal}';" | tr -d '[:space:]')"
if [ "$db_exists" != "1" ]; then
  echo "[db:init] creating database: $DB_APP_DB"
  psql "$DB_ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${app_db_ident}\" OWNER \"${app_user_ident}\";"
else
  echo "[db:init] database already exists: $DB_APP_DB"
fi

psql "$DB_ADMIN_URL" -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE \"${app_db_ident}\" TO \"${app_user_ident}\";"

app_db_url="postgresql://${DB_APP_USER}:${DB_APP_PASSWORD}@${DB_APP_HOST}:${DB_APP_PORT}/${DB_APP_DB}"
psql "$app_db_url" -v ON_ERROR_STOP=1 -c "GRANT USAGE, CREATE ON SCHEMA \"${app_schema_ident}\" TO \"${app_user_ident}\";"
psql "$app_db_url" -v ON_ERROR_STOP=1 -c "ALTER SCHEMA \"${app_schema_ident}\" OWNER TO \"${app_user_ident}\";"

echo "[db:init] done"
echo "[db:init] DATABASE_URL='${DATABASE_URL}'"
echo "[db:init] if needed, update .env with this DATABASE_URL"

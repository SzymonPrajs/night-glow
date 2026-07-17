#!/usr/bin/env bash
set -euo pipefail

mode=${1:-status}

if [[ -f supabase/config.toml ]]; then
  adapter=supabase
elif [[ -f prisma/schema.prisma ]]; then
  adapter=prisma
else
  adapter=none
fi

case "$mode:$adapter" in
  status:none)
    printf 'Database: none configured; no migrations are required.\n'
    ;;
  migrate:none)
    printf 'Database: none configured; migration is a safe no-op.\n'
    ;;
  status:supabase)
    printf 'Database: Supabase configuration detected.\n'
    ;;
  migrate:supabase)
    command -v supabase >/dev/null 2>&1 || {
      printf 'Supabase CLI is required for migrations.\n' >&2
      exit 1
    }
    supabase db push
    ;;
  status:prisma)
    printf 'Database: Prisma schema detected.\n'
    ;;
  migrate:prisma)
    npx prisma migrate deploy
    ;;
  *)
    printf 'usage: %s status|migrate\n' "$0" >&2
    exit 2
    ;;
esac

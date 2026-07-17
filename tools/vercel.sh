#!/usr/bin/env bash
set -euo pipefail

if command -v vercel >/dev/null 2>&1; then
  exec vercel "$@"
fi

printf 'Vercel CLI is not installed. Install it with:\n' >&2
printf '  npm install --global vercel\n' >&2
printf 'Then authenticate with `vercel login` or provide VERCEL_TOKEN.\n' >&2
exit 1

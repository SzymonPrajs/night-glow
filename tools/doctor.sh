#!/usr/bin/env bash
set -euo pipefail

required=(make node npm cargo rustc python3)
missing=()

for command_name in "${required[@]}"; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    missing+=("$command_name")
  fi
done

if ((${#missing[@]})); then
  printf 'Missing required tools: %s\n' "${missing[*]}" >&2
  printf 'Install Node.js, Rust, GNU Make, and Python 3 before continuing.\n' >&2
  exit 1
fi

printf 'node  %s\n' "$(node --version)"
printf 'npm   %s\n' "$(npm --version)"
printf 'rustc %s\n' "$(rustc --version)"
printf 'cargo %s\n' "$(cargo --version)"

if command -v vercel >/dev/null 2>&1; then
  printf 'vercel CLI available\n'
else
  printf 'vercel CLI not installed; deployment targets will explain how to install it.\n'
fi

./tools/database.sh status

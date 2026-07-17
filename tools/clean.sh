#!/usr/bin/env bash
set -euo pipefail

mode=${1:-build}

targets=(
  apps/reference-viewer/dist
  apps/reference-viewer/output
  apps/reference-viewer/coverage
  apps/reference-viewer/playwright-report
  apps/reference-viewer/test-results
  apps/reference-viewer/tsconfig.app.tsbuildinfo
  apps/reference-viewer/tsconfig.node.tsbuildinfo
  apps/viewer/.next
  apps/viewer/dist
  apps/viewer/coverage
  .vercel
)

if [[ "$mode" == all ]]; then
  targets+=(apps/reference-viewer/node_modules apps/viewer/node_modules)
elif [[ "$mode" != build ]]; then
  printf 'usage: %s [all]\n' "$0" >&2
  exit 2
fi

remove_target() {
  local target=$1
  if command -v trash >/dev/null 2>&1; then
    trash "$target"
    printf 'Moved to Trash: %s\n' "$target"
  else
    rm -rf -- "$target"
    printf 'Removed generated path: %s\n' "$target"
  fi
}

for target in "${targets[@]}"; do
  if [[ -e "$target" ]]; then
    remove_target "$target"
  fi
done

while IFS= read -r target; do
  [[ -n "$target" ]] || continue
  remove_target "$target"
done < <(find packages -mindepth 2 -maxdepth 2 -type d -name target -print)

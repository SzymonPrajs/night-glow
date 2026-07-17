#!/usr/bin/env bash
set -euo pipefail

mode=${1:-}

case "$mode" in
  prepare)
    if command -v rustup >/dev/null 2>&1; then
      rustup target add wasm32-unknown-unknown
    else
      printf 'rustup not available; skipping automatic wasm32 target installation.\n'
    fi
    exit 0
    ;;
  check|test|build) ;;
  wasm) ;;
  *)
    printf 'usage: %s prepare|check|test|build|wasm\n' "$0" >&2
    exit 2
    ;;
esac

if [[ "$mode" == wasm ]]; then
  manifests=$(find packages -path '*/bindings/wasm/Cargo.toml' -type f -print | sort)
  cargo_command=(cargo build --release --target wasm32-unknown-unknown)
else
  manifests=$(find packages -mindepth 2 -maxdepth 2 -name Cargo.toml -type f -print | sort)
  cargo_command=(cargo "$mode")
fi

if [[ -z "$manifests" ]]; then
  printf 'No implemented Rust %s manifests yet; nothing to compile.\n' "$mode"
  exit 0
fi

built=0
while IFS= read -r manifest; do
  [[ -n "$manifest" ]] || continue
  package_count=$(cargo metadata --manifest-path "$manifest" --no-deps --format-version 1 |
    python3 -c 'import json,sys; print(len(json.load(sys.stdin)["packages"]))')
  if [[ "$package_count" == 0 ]]; then
    printf 'Skipping design-only empty workspace %s\n' "$manifest"
    continue
  fi
  printf '%s %s\n' "${cargo_command[*]}" "$manifest"
  "${cargo_command[@]}" --manifest-path "$manifest"
  built=$((built + 1))
done <<< "$manifests"

if [[ "$built" == 0 ]]; then
  printf 'Rust workspace manifests are present, but no packages are implemented yet.\n'
fi

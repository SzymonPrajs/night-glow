# Repository tooling boundary

This directory owns implemented cross-package orchestration: reproducibility and
contract checks, native/Wasm probes, documentation validation, safe cleanup and
commands that coordinate more than one workspace. Future release tooling belongs
here under the same ownership rules.

Domain logic stays with its owner:

- Environment ingestion and release construction belongs in
  [`packages/environment/apps/precompute`](../packages/environment/apps/precompute/README.md).
- Physics catalogue preparation, lookup tables, and reference solves belong in
  [`packages/physics/apps/precompute`](../packages/physics/apps/precompute/README.md).
- Viewer build and browser tooling belongs in [`apps/viewer`](../apps/viewer/README.md).

No scientific equation, provider-specific decoder, or UI implementation should be
placed in a generic root script merely because several packages invoke it.

## Current root tooling

- `doctor.sh` checks the reproducible local prerequisites.
- `rust-workspaces.sh` discovers and compiles implemented native and Wasm
  manifests while identifying documentation-only empty workspaces honestly.
- `database.sh` is the single migration adapter; it currently reports that no
  database exists and performs a safe no-op.
- `vercel.sh` requires an installed, authenticated Vercel CLI and never downloads
  tooling or stores credentials implicitly.
- `check-links.mjs` validates repository-local Markdown references.
- `check-contract-fixtures.mjs` validates first-slice schemas, identities,
  quantities, conservation, axes and buffer lengths.
- `check-reproducibility.mjs` verifies pinned toolchains/assets, hashes and
  licence records.
- `probe-wasm.mjs` measures independently compiled Environment/Physics Wasm
  startup, memory and fixture parity.
- `clean.sh` removes only enumerated generated paths, using the system Trash when
  available.

The root [`Makefile`](../Makefile) is the public interface. These helpers are its
implementation details rather than competing command surfaces.

See the repository [implementation status](../implementation/STATUS.md) for the
verified checkpoint and remaining gates.

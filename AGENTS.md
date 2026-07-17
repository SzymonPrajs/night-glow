# Night Glow repository guidance

Use the root `Makefile` as the canonical operational interface. Start with
`make help`, use `make setup` for a fresh checkout, `make dev` to launch the
implemented website, `make build` for all implemented web/native/Wasm targets,
and `make check` before handing off changes.

## Ownership boundaries

- `packages/environment/` reconstructs environmental products; it never
  propagates light.
- `packages/physics/` owns astronomy, optical conversion, physical equations,
  solvers, and observation products.
- `runtime/browser-worker/` coordinates independently versioned Wasm modules,
  buffers, cancellation, and runtime lifecycle; it owns no scientific formula.
- `apps/viewer/` owns product interaction, WebGL resources, and display transforms.
- `apps/reference-viewer/` is the runnable behavioral fixture until the production
  Viewer has an implementation.
- `tools/` may coordinate packages but must not become a home for domain logic.

Do not duplicate Physics in TypeScript, GLSL, worker glue, or Environment code.
Do not add provider ingestion to the browser. Preserve immutable product and
scenario revisions at every package boundary.

There is currently no database. `make db-status` reports this and
`make db-migrate` is intentionally a safe no-op. When a database is introduced,
add its committed schema/migrations and a reviewed adapter in
`tools/database.sh`; never place credentials in the repository.

Deployment targets require an authenticated Vercel CLI but must never embed a
token. Local secrets belong in ignored environment files or the deployment
platform. Generated dependencies, builds, Rust targets, local scientific data,
and Vercel state must remain uncommitted.

# Acceptance manifests

These small, hand-authored JSON files are tracked because they make project
gates machine-readable. They are policy and provenance inputs, not generated
test output.

- `m0-first-slice.json` is the first-slice threshold authority. Contract,
  native/Wasm and browser-worker checks load its numeric and runtime limits.
- `non-ui-build-inputs.json` pins toolchains and exact hashes for reproducible
  non-UI builds and reference inputs. `make reproducibility-check` verifies it.
- `non-ui-license-report.json` records the declared licence and redistribution
  status of source packages and reference assets. The same check verifies every
  asset hash.

Keep these files committed and review changes to them like code. Generated
reports belong in ignored build/output directories, not here.

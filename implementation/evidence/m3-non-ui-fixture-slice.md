# M3 non-UI fixture-slice report — 2026-07-17

## Scope and result

The synthetic first slice now runs from immutable Environment JSON products to
an atomic Physics render product through independently compiled Environment and
Physics Wasm modules. It stops at the coordinator's transferable-buffer boundary.
No production Viewer, route, component, WebGL renderer, or display transform was
implemented as part of this slice.

The committed dependency identities are:

- emission release `emission:fixture:central-poland-2x2:v1`;
- atmosphere release `atmosphere:fixture:central-poland-2x2x3:v1`;
- standard atmosphere scenario `clear-winter-layered-v1` at
  `2024-01-15T00:00:00Z`;
- Physics model `fixture-single-scatter-scalar-v1` and data manifest
  `physics-data:fixture:v1`;
- terrain product `surface-terrain:fixture-flat-lambertian:v1`;
- observer scenario schema `observer-scenario-fixture-v1`, revision 1;
- coherent product schema `observer-render-fixture-v1` and fixture ABI
  `physics-abi-fixture-v1`;
- runtime compatibility manifest
  `nightglow-runtime-compatibility-fixture-v1`, which fail-closes on drift in
  protocol, Wasm ABI, release, time, Physics/data/optics, terrain, projection,
  or output-shape identities before execution.

## Executed evidence

| Boundary | Command | Result |
| --- | --- | --- |
| contract and schema descriptors | `make contract-check` | JSON Schema declarations, SHA-256 fixture identities, cross-product IDs, units, axes, conservation, terrain and buffer lengths pass |
| Environment native boundary | `cargo test --manifest-path packages/environment/Cargo.toml` | 18 tests pass across typed identity/time/evidence primitives, schema, query, synthetic Black Marble and atmosphere-provider metadata normalization, deterministic precompute orchestration, validation and Wasm-adapter crates |
| Environment precompute orchestration | `cargo run --release --manifest-path packages/environment/Cargo.toml -p environment-precompute -- fixture-report` | emits a stable report for 7 normalized emission pixels and 3 provider-variable extracts while declaring that no provider bytes were fetched or decoded |
| Environment conformance | `cargo run --release --manifest-path packages/environment/Cargo.toml -p environment-conformance` | 4 emission cells conserve 70 W sr^-1; queried atmosphere shape is 2×2×3 with mean surface pressure 99,850 Pa |
| Physics native boundary | `cargo test --manifest-path packages/physics/Cargo.toml` | 26 tests pass across typed scenarios/errors, astronomy, data, the independent complete-fixture Environment adapter, wet/dry and release/time rejection, flat and spherical transfer primitives, `f32` publication-overflow rejection, deterministic precompute orchestration, external-reference validation, DAG scheduling/cancellation and Wasm output |
| Physics precompute orchestration | `cargo run --release --manifest-path packages/physics/Cargo.toml -p nightglow-precompute -- fixture-report` | consumes both independent Environment releases plus Physics manifest/terrain/scenario identities and emits a stable coherent 2×4×3 product summary through the shared solver |
| Physics reference solve | `cargo run --release --manifest-path packages/physics/Cargo.toml -p nightglow-validation` | 24 coherent `f32` values match the language-neutral fixture with maximum relative error `4.094373956018e-8`; fine vertical error is `2.793967610559e-7`; the spherical horizon integral is `33.969905248062` with `3.974197714376e-15` refinement drift; 3 libRadtran DISORT pure-absorption cases agree within `6.642263376598e-8` |
| dual Wasm boundary | `make wasm-probe` | Environment/Physics modules are 25,887/317,380 bytes; each begins at 1,114,112 bytes; Physics Wasm decodes the shared atmosphere fixture to 99,850 Pa, scalar drift is 0 and product drift is `4.094373906582405e-8` |
| coordinator lifecycle | `make coordinator-test` | 12 tests pass: coherent dual-Wasm output, cancellation under the 100 ms budget, stale-result rejection, unit failure, memory-budget failure, fail-closed runtime-manifest and Physics-identity checks, finite-input/`f32`-output overflow rejection, explicit buffer release on success/failure, stable linear memory across 100 scenarios, runtime disposal during pending work, and worker disposal acknowledgement |
| reproducible inputs and licences | `make reproducibility-check` | exact Node/Rust versions, 14 build/asset hashes and 8 asset licence records pass; all 6 libRadtran reference-input/output artifact hashes pass; the JPL snapshot and source-code distribution remain explicitly review-required |
| non-UI CI surface | `make non-ui-check` | documentation, fixtures, input hashes, formatting, both Rust workspaces, dual Wasm parity and coordinator tests pass in one command |

## Error accounting

- Source/reconstruction error is not quantified: the emission and atmosphere
  products are synthetic, CC0 fixtures, not provider-derived evidence.
- Atmospheric-state uncertainty is explicitly `synthetic-not-statistical`; the
  fixture validates selection, axes, pressure ordering and units only.
- Numerical error is bounded for the analytic exponential-column proof, the
  pure-absorption libRadtran comparison, and the fixture `f64` to `f32`
  publication comparison above. Non-finite or negative `f32` publication is
  rejected rather than exposed. No external scattering comparison is claimed.
- Physical-model error is not calibrated. The response basis is a frozen
  synthetic contract value, not an observation or a reference-transfer result.
- Display error is not measured because no display transform or UI is included.

## Deliberate exclusions

This result does not close the real Black Marble/atmosphere ingest probes, the
curved-Earth reference-transfer comparison, production astronomy, multiple
scattering, uncertainty calibration, global publication, Viewer implementation,
or deployment gates. Those remain separately visible in the master plan.

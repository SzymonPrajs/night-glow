# M1 bounded-proof record — 2026-07-17

This record separates executed evidence from planned production claims. Commands
were run from the repository root on an Apple Silicon development machine unless
noted otherwise.

## Accepted bounded results

| Proof | Executed evidence | Result |
| --- | --- | --- |
| fixture quantities and identities | `make contract-check` | SHA-256 identities, cross-release IDs, 70 W sr^-1 exact support integration, atmosphere axes/pressure ordering and render lengths pass |
| Environment contract slice | `cargo test --manifest-path packages/environment/Cargo.toml` and `make native-probe` | 10 tests pass; independent release decoders and contiguous queries recover 70 W sr^-1 and 99,850 Pa |
| native reference kernel | `cargo run --release --manifest-path packages/physics/Cargo.toml -p nightglow-validation` | fine exponential-column integration error `2.793967610559e-7`; positive bounded single-scatter case; 24–35 µs across final local runs |
| astronomy reference | `npm --prefix apps/reference-viewer run test:astronomy` | Sun/Moon/Mars against JPL Horizons: worst angular error `3.2063` arcsec and distance relative error `1.0437e-4` |
| native/Wasm boundary | `make wasm-probe` | Environment/Physics modules are 25,565/26,932 bytes, each starts at 1,114,112 bytes, scalar JS/Wasm drift is 0, and coherent-product relative error is `4.0944e-8` |
| non-UI coordinator | `make coordinator-test` | 5 tests pass against both Wasm modules: coherent product, cancellation, stale revision, unit drift, and resource budget |
| worker-to-WebGL2 HDR path | `npm --prefix apps/reference-viewer run test:m1-browser` | transferable detached, stale revision cancelled under 100 ms, coherent revision 2 uploaded/read back within `1e-6`, resources disposed |
| Next/MapLibre/observer runtime | build, audit and `test:m1-runtime` | Next 16.2.10 static routes build; production dependency audit has 0 findings; `/globe` and `/observe` pass with no browser errors |
| route separation | `test:m1-runtime` network measurement | repeated clean runs transferred 1.74–1.79 MB of scripts for globe and 0.24–0.32 MB for observer; MapLibre remains out of observer startup |

## Decisions from the evidence

- Accept the shared Rust core and raw single-worker Wasm boundary for continued
  conformance work.
- Accept Next.js App Router route separation locally; keep the large MapLibre
  payload on the globe route and set compressed production budgets only after a
  representative layer/basemap build.
- Accept transferable linear-float render products and explicit disposal as the
  baseline. Threads, OffscreenCanvas and GPU scientific compute remain deferred.
- Accept Astronomy Engine only as the preserved reference-viewer baseline. The
  production Rust astronomy implementation still needs its own JPL/SOFA parity.

## Still open; not claimed as passed

- No real Black Marble feasibility subset has been ingested, so provider SDS,
  QA/fill semantics, normalization and redistribution remain open.
- No credentialed ERA5/CAMS/MERRA-2 subset has been retrieved, so the synthetic
  atmosphere fixture proves encoding semantics only, not variable availability,
  licence compatibility or physical fidelity.
- The native transfer proof is an analytic exponential/homogeneous case, not yet
  the planned curved-Earth vertically varying comparison against libRadtran.
- Vercel deployment, range/MIME/cache headers and cross-origin profiles were not
  tested because this checkout has no authenticated Vercel CLI.
- The custom globe layer proves lifecycle and route isolation, not projection
  accuracy, numeric picking, seams, basemap licensing or context restoration.

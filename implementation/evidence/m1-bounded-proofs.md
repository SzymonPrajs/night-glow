# M1 bounded-proof record — 2026-07-17

This record separates executed evidence from planned production claims. Commands
were run from the repository root on an Apple Silicon development machine unless
noted otherwise.

## Accepted bounded results

| Proof | Executed evidence | Result |
| --- | --- | --- |
| fixture quantities and identities | `make contract-check` | SHA-256 identities, cross-release IDs, 70 W sr^-1 exact support integration, atmosphere axes/pressure ordering and render lengths pass |
| Environment contract slice | `cargo test --manifest-path packages/environment/Cargo.toml` and `make native-probe` | 18 tests pass; typed identities/time/evidence, independent release decoders, extracted provider metadata normalization and contiguous queries recover 70 W sr^-1 and 99,850 Pa |
| Black Marble C2 normalization fixture | `cargo test --manifest-path packages/environment/Cargo.toml -p emission-ingest-black-marble` | metadata, fill, all mandatory QA states, snow, cloud-mask bits, direct/gap-filled separation, and unit/scale corruption pass against an invented CC0 extraction |
| atmosphere provider normalization fixture | `cargo test --manifest-path packages/environment/Cargo.toml -p atmosphere-ingest` | ERA5, CAMS and MERRA-2 extracted-variable metadata, missingness, explicit unit conversions, vertical coordinates and wet/dry aerosol basis pass against an invented CC0 extraction |
| deterministic Environment precompute CLI | `cargo run --release --manifest-path packages/environment/Cargo.toml -p environment-precompute -- fixture-report` | canonical adapters produce a stable JSON report for 7 emission pixels and 3 atmosphere variables without network access, provider decoding, inference, fusion or publication |
| native reference kernel | `cargo run --release --manifest-path packages/physics/Cargo.toml -p nightglow-validation` | fine exponential-column integration error `2.793967610559e-7`; spherical-horizon optical depth `33.969905248062` converges within `3.9742e-15`; 3 libRadtran DISORT pure-absorption cases agree within `6.6423e-8` |
| libRadtran reference fixture | official libRadtran 2.0.6 source archive plus committed reproduction inputs | source archive SHA-256 `64930cc4…d69840`; projected direct-beam transmittance at solar zenith 0°, 30° and 45° is preserved with exact solver/version/quantity/licence identities |
| deterministic Physics precompute CLI | `cargo run --release --manifest-path packages/physics/Cargo.toml -p nightglow-precompute -- fixture-report` | Physics decoders consume the two independent Environment products, validate the manifest/terrain/scenario, run the shared solver and report a coherent 2×4×3 product without raw provider ingest or publication |
| astronomy reference | `npm --prefix apps/reference-viewer run test:astronomy` | Sun/Moon/Mars against JPL Horizons: worst angular error `3.2063` arcsec and distance relative error `1.0437e-4` |
| native/Wasm boundary | `make wasm-probe` | Environment/Physics modules are 25,887/317,380 bytes, each starts at 1,114,112 bytes; the Physics Wasm adapter independently decodes the full shared atmosphere fixture to 99,850 Pa, scalar JS/Wasm drift is 0, and coherent-product relative error is `4.0944e-8` |
| non-UI coordinator | `make coordinator-test` | 12 tests pass against both Wasm modules and the worker adapter: coherent product, cancellation, stale revision, unit drift, resource budget, runtime-manifest/Physics-identity rejection, `f64`-to-`f32` overflow rejection, success/failure buffer release, stable memory across 100 scenarios, complete runtime disposal during pending work, and worker disposal acknowledgement |
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

- No real Black Marble feasibility subset has been ingested. The Collection 2
  metadata/QA normalizer now has a synthetic extraction, but actual HDF5 bytes,
  geolocation, provider-value comparison, access and redistribution remain open.
- No credentialed ERA5/CAMS/MERRA-2 subset has been retrieved. The extracted
  metadata normalizer is backed only by invented values, so it proves encoding
  semantics, unit rejection and provenance preservation—not variable
  availability, provider file decoding, licence compatibility or physical
  fidelity.
- The native transfer proof now includes a real libRadtran DISORT comparison,
  but only for plane-parallel pure absorption. Curved-Earth vertically varying
  radiance, diffuse scattering, aerosols, clouds, surfaces and multiple
  scattering remain unvalidated against an external solver.
- Vercel deployment, range/MIME/cache headers and cross-origin profiles were not
  tested because this checkout has no authenticated Vercel CLI.
- The custom globe layer proves lifecycle and route isolation, not projection
  accuracy, numeric picking, seams, basemap licensing or context restoration.

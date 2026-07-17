# Review-gated roadmap

No phase should begin merely because folders exist. Each gate produces reviewable evidence.

## Phase 0 — architecture review (this folder)

Deliverables:

- module ownership and dependency rules;
- computation DAG and cache/invalidation model;
- candidate data sources, licenses, calibration concerns, and alternatives;
- equations and approximation families to investigate;
- WebGL/Wasm contracts;
- validation cases and acceptance criteria;
- explicit open decisions.

Gate: physics and software reviewers agree that every important calculation has one owner and that no required coupling is missing from the DAG.

## Phase 1 — executable reference kernel

Build `nightglow-core`, the smallest astronomy/time/frame subset, and an `f64` reference solver for a deliberately narrow case: spherical atmosphere, known vertical profile, Sun as the only source, Lambertian ground, no clouds. Establish units and conservation tests first.

Gate: convergence sweeps and comparison against an external radiative-transfer reference meet agreed tolerances. No browser work yet.

## Phase 2 — native precompute pipeline

Add deterministic manifests, atmospheric transfer tables, terrain/surface products, catalogue tiling, diffuse-sky products, and emission-atlas adapter. Generate a small geographic/sky fixture before global products.

Gate: two clean runs from pinned inputs yield identical hashes; every tile has provenance and quality metadata; spot checks reconstruct source quantities within tolerance.

## Phase 3 — source completeness

Add lunar reflection and earthshine, planets, resolved stars, unresolved Galactic light, airglow, zodiacal light, aerosols, clouds, terrain horizons, surface BRDF, and artificial illumination progressively. Each source lands behind validation evidence rather than a visual-only demo.

Gate: source isolation tests, energy checks, ephemeris checks, and representative observed-sky comparisons pass.

## Phase 4 — Wasm execution target

Compile the same crates to Wasm, expose coarse tile/solve APIs, add cancellation, implement single-worker baseline, and then optional threaded execution. Benchmark boundary transfer, memory high-water marks, startup, and refinement latency.

Gate: native and Wasm outputs agree to declared precision tolerance for the same fixture; UI remains responsive under cancellation and rapid parameter changes.

## Phase 5 — WebGL2 integration

Replace display-oriented scalar textures with versioned HDR/spectral render products, add stable star buffers and tiled diffuse fields, implement physically ordered PSF/composition, and keep tone mapping last.

Gate: no visible block boundaries at target display size; resolution increases demonstrate convergence; GPU timing and memory fit the supported device envelope.

## Phase 6 — Vercel productionization

Publish content-addressed assets, immutable caching policy, worker/Wasm bundles, cross-origin-isolation headers for the threaded tier, feature detection, fallbacks, observability, and browser/device performance tests.

Gate: cold/warm load budgets, memory limits, cancellation behavior, visual regression, numeric smoke tests, and fallback behavior pass on the supported browser/device matrix.

## Phase 7 — calibration and scientific audit

Calibrate against measured all-sky radiance and known observing conditions, quantify uncertainty, document validity limits, and freeze a versioned scientific model release.

Gate: independent review can reproduce inputs, build assets, rerun validation, and explain differences between prediction and observation.

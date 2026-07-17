# Implementation status — 2026-07-18

This is the concise, current implementation snapshot. The
[master plan](README.md) remains authoritative for ordering and gates; the
[M1 evidence](evidence/m1-bounded-proofs.md) and
[non-UI vertical-slice report](evidence/m3-non-ui-fixture-slice.md) contain the
executed measurements and limitations.

## At a glance

| Area | Implemented and verified | Still open |
| --- | --- | --- |
| Foundations and contracts | M0 and M2; versioned schemas, fixtures, identities, ownership rules, reproducibility and licence manifests | broader production schemas and formally reviewed module ownership |
| Environment | typed Rust workspace, immutable emission/atmosphere fixture decoders, conservative `J_DNB` support integration, contiguous queries, synthetic Black Marble C2 and ERA5/CAMS/MERRA-2 metadata normalizers, deterministic native precompute probe, field-sized Wasm adapter | real provider-file retrieval/decoding, regional reconstruction, fusion, calibrated uncertainty, chunk publication and global releases |
| Physics | typed scenario/data/terrain products, independent complete-fixture Environment adapter, deterministic solver DAG, analytic flat and spherical atmosphere primitives, native precompute probe, libRadtran pure-absorption comparison, native/Wasm parity | production astronomy, spectral molecular/aerosol/cloud closure, externally validated curved-Earth scattering, terrain/surface coupling, complete sources, PSF and calibrated observations |
| Browser worker | independently compiled Environment and Physics Wasm modules, immutable compatibility manifest, structured failures, cancellation, coherent publication, buffer release, runtime disposal and bounded-memory tests | production release/chunk caches, progressive refinement, measured transfer tiers, optional SIMD/threads/shared memory and device recovery |
| Viewer | existing Vite reference viewer remains runnable; bounded Next/MapLibre/WebGL2 runtime experiments exist | production Viewer application and all user-facing integration; this was intentionally outside the non-UI implementation slice |
| Deployment | local build and safe adapters | authenticated Vercel preview/production evidence, CDN/object-storage selection, headers, rollback and observability |

## Completed system slices

- **M0 is complete:** ownership, package boundaries, first-slice decisions,
  conventions and measurable acceptance targets are frozen.
- **M2 is complete for the synthetic contract slice:** both Rust workspaces,
  language-neutral contracts, native/Wasm builds and conformance tooling exist.
- **The non-UI portion of M3 is complete:** one immutable scenario runs from
  independent Environment releases through Physics and the coordinator to a
  coherent transferable `2 x 4 x 3` linear-radiance product. The two production
  Viewer tasks remain open, so M3 as a whole is not complete.
- **M1 remains active:** its software-boundary proofs passed, while real-data,
  curved-Earth reference-transfer and production delivery proofs remain open.

## Verified checkpoint

The repository passed `make non-ui-check` and the canonical `make check` before
this status was merged. The recorded non-UI checkpoint includes:

- 18 Environment tests, 26 Physics tests and 12 coordinator/worker tests;
- 13 pinned build/asset inputs and 8 licence records;
- 70 W sr^-1 conserved fixture directional intensity and 99,850 Pa mean fixture
  surface pressure;
- Environment and Physics Wasm sizes of 25,887 and 317,380 bytes, each starting
  with 1,114,112 bytes of linear memory;
- maximum fixture render-product relative error of
  `4.094373906582405e-8` across the native/Wasm boundary;
- fine exponential-column integration relative error of
  `2.793967610559e-7`;
- three libRadtran 2.0.6 DISORT pure-absorption cases agreeing within
  `6.642263376598e-8`;
- spherical-horizon optical-depth refinement drift of
  `3.974197714376e-15` for the internal convergence case;
- stable Wasm memory across 100 repeated scenarios, fail-closed identity checks,
  cancellation, explicit buffer release, complete runtime disposal, and
  non-finite/overflowing `f32` output rejection.

These figures validate the bounded fixture architecture, not a calibrated sky
prediction.

## Critical path from here

1. Retrieve and inspect a real Black Marble Collection 2 subset, preserving
   provider radiometry, geolocation and QA without inferring hemispheric power.
2. Retrieve matched, credentialed ERA5/CAMS/MERRA-2 subsets and close variables,
   vertical coordinates, wet/dry semantics, licensing and compact encoding.
3. Validate curved-Earth, vertically varying scattering against an independent
   reference solver before selecting the interactive approximation.
4. Build regional Environment v1 products and Physics optical closure from those
   products, retaining separate source, state, numerical and model errors.
5. Begin the production Viewer only when the regional products and solver
   contracts are ready; deployment and device tiers follow measured integration.

## Explicit non-claims

There is no real provider-derived Environment release, production radiative-
transfer solver, calibrated all-sky prediction, production Viewer, global data
publication, or production deployment yet. Synthetic fixtures are labelled as
such and do not close those gates.

# Night Glow Rust physics toolkit — design workspace

This folder is a **documentation-first architecture proposal**. It deliberately contains no Rust implementation or Cargo workspace yet. Its purpose is to make the physics boundaries, computation order, datasets, numerical methods, browser contract, and validation gates reviewable before code fixes those choices in place.

The central rule is simple:

> There will be one Rust implementation of each physical calculation. Native precomputation and browser WebAssembly will be two execution targets over that implementation. WebGL2 will render the resulting radiance fields; it will not own the physics.

## Start here

1. [Architecture](ARCHITECTURE.md) — proposed crates and ownership rules.
2. [Computation DAG](COMPUTATION_DAG.md) — required physical and scheduling order.
3. [Physics model](docs/PHYSICS_MODEL.md) — quantities, source terms, and transfer model.
4. [Numerical methods](docs/NUMERICAL_METHODS.md) — grids, precision, convolution, and convergence.
5. [Data and provenance](docs/DATA_AND_PROVENANCE.md) — catalogues, maps, calibration, licensing, and manifests.
6. [WebGL contract](docs/contracts/WEBGL_CONTRACT.md) and [Wasm ABI](docs/contracts/WASM_ABI.md).
7. [Validation plan](docs/VALIDATION_PLAN.md), [roadmap](ROADMAP.md), and [open TODO](TODO.md).

## Proposed workspace shape

```text
rust-physics/
├── crates/
│   ├── nightglow-core/          units, spectra, coordinates, grids, identifiers
│   ├── nightglow-physics/       one module per physical phenomenon
│   ├── nightglow-astronomy/     time, frames, ephemerides, star motion, sky tiling
│   ├── nightglow-data/          versioned loaders and calibrated data products
│   ├── nightglow-solver/        dependency graph, caches, refinement, cancellation
│   └── nightglow-validation/    reference cases and comparison adapters
├── apps/precompute/             native dataset and lookup-table compiler
├── bindings/wasm/               thin browser ABI; no independent physics
└── docs/                        design, contracts, decisions, and research dossiers
```

Every proposed calculation module has its own README under
[`crates/nightglow-physics/modules`](crates/nightglow-physics/modules/README.md). The astronomy submodules are indexed under
[`crates/nightglow-astronomy/modules`](crates/nightglow-astronomy/modules/README.md).

## Relationship to current work

- The existing TypeScript seeing/PSF implementation remains the initial behavioral fixture. The Rust PSF module must first reproduce it exactly, then extend it with physically richer atmospheric and instrument profiles. See [PSF research](docs/research/psf-and-observation.md).
- The existing `emission-atlas/` package remains independent during design review. It is a likely upstream implementation of an `EmissionFieldProvider`, not something to duplicate or silently absorb. See [artificial-light research](docs/research/artificial-light.md).
- The current application remains runnable while this design is reviewed. No current renderer, solver, PSF, or emission-atlas files are changed by this skeleton.

## Non-goals of this review stage

- No claim that a visually smooth result is physically converged.
- No single baked RGB sky photograph standing in for calibrated spectral radiance.
- No physics embedded in GLSL, TypeScript, or Wasm glue merely for convenience.
- No assumption that every browser supports Wasm threads or every GPU supports the same float render-target features.
- No implementation until the module boundaries, units, data licenses, and validation cases have been reviewed.

## Review questions

The most consequential unresolved choices are collected in
[`docs/decisions/OPEN_DECISIONS.md`](docs/decisions/OPEN_DECISIONS.md). Review should concentrate on physical fidelity tiers, spectral basis, atmospheric solver family, catalogue/map licensing, browser fallback level, and the boundary between precomputed transfer and interactive source evaluation.

# Night Glow physics toolkit

This folder contains the reviewed architecture plus the first bounded Rust
vertical slice: typed scenarios and products, an independent Environment fixture
adapter, a Physics-owned terrain product and response manifest, minimal boundary
source/optical-state construction, an analytic single-scatter response, native
validation, and a thin raw Wasm export. It is not yet the production solver.

The central rule is simple:

> There will be one Rust implementation of each physical calculation. Native precomputation and browser WebAssembly will be two execution targets over that implementation. WebGL2 will render the resulting radiance fields; it will not own the physics.

## Start here

1. [Unified system contract](../contracts/README.md) — canonical cross-project language, scenario and lifecycle.
2. [Architecture](docs/architecture/overview.md) — proposed crates and ownership rules.
3. [Computation DAG](docs/architecture/computation-dag.md) — required physical and scheduling order.
4. [Physics model](docs/models/physics-model.md) — quantities, source terms, and transfer model.
5. [Numerical methods](docs/models/numerical-methods.md) — grids, precision, convolution, and convergence.
6. [Data and provenance](docs/governance/data-and-provenance.md) — catalogues, maps, calibration, licensing, and manifests.
7. [WebGL contract](docs/contracts/webgl.md) and [Wasm ABI](docs/contracts/wasm-abi.md).
8. [Environment consumer contract](docs/contracts/environment.md) — the two independent environment-product boundaries.
9. [Emission contract](docs/contracts/emission-release.md) — detailed surface-source semantics.
10. [Viewer integration contract](docs/contracts/viewer.md) — observer scenarios, render products, and coherent updates.
11. [Validation plan](docs/governance/validation-plan.md), [roadmap](docs/governance/roadmap.md), and [open TODO](docs/governance/todo.md).

## Workspace shape

```text
packages/physics/
├── crates/
│   ├── nightglow-core/          units, spectra, coordinates, grids, identifiers
│   ├── nightglow-physics/       one module per physical phenomenon
│   ├── nightglow-astronomy/     time, frames, ephemerides, star motion, sky tiling
│   ├── nightglow-data/          versioned loaders and calibrated data products
│   ├── nightglow-solver/        dependency graph, caches, refinement, cancellation
│   └── nightglow-validation/    reference cases and comparison adapters
├── apps/precompute/             native dataset and lookup-table compiler
├── bindings/wasm/               thin browser ABI; no independent physics
└── docs/
    ├── architecture/            crate graph and computation order
    ├── models/                  equations and numerical methods
    ├── contracts/               Environment, Viewer, Wasm, and WebGL boundaries
    ├── governance/              data, validation, roadmap, and TODO
    ├── decisions/               architecture decision records
    └── research/                phenomenon-specific research dossiers
```

Every proposed calculation module has its own README under
[`crates/nightglow-physics/modules`](crates/nightglow-physics/modules/README.md). The astronomy submodules are indexed under
[`crates/nightglow-astronomy/modules`](crates/nightglow-astronomy/modules/README.md).

## Relationship to current work

- The existing TypeScript seeing/PSF implementation remains the initial behavioral fixture. The Rust PSF module must first reproduce it exactly, then extend it with physically richer atmospheric and instrument profiles. See [PSF research](docs/research/psf-and-observation.md).
- The sibling [Environment](../environment/README.md) package remains independent. Its emission domain owns source reconstruction, `J_DNB [W sr^-1]`, H3 hierarchy and source profiles. Its atmosphere domain owns measured/modelled four-dimensional meteorological, aerosol and cloud state. The domains publish independently; Physics consumes both, converts state to spectral optics, and performs propagation. See the [Environment contract](docs/contracts/environment.md), [emission contract](docs/contracts/emission-release.md), and [artificial-light research](docs/research/artificial-light.md).
- The current application remains runnable while this design is reviewed. The Physics project does not absorb the current renderer, solver, PSF implementation, or Environment emission domain workspace.
- The independent [Viewer](../../apps/viewer/README.md) owns the two-view UI, globe, observer WebGL engine, routing, display transforms, and Vercel deployment. Physics participates only through committed scenarios and versioned observer render products. See the [Viewer contract](docs/contracts/viewer.md).

## Current non-goals

- No claim that a visually smooth result is physically converged.
- No single baked RGB sky photograph standing in for calibrated spectral radiance.
- No physics embedded in GLSL, TypeScript, or Wasm glue merely for convenience.
- No assumption that every browser supports Wasm threads or every GPU supports the same float render-target features.
- No provider ingestion, production ephemerides, calibrated multi-source sky, or
  optimized interactive solver before its specific gate and evidence.
- No claim that the synthetic response-basis fixture is a calibrated sky. It
  exists to prove identities, ownership, coherent publication, and native/Wasm
  parity before the real-data and reference-transfer gates close.

## Review questions

The most consequential unresolved choices are collected in
[`docs/decisions/open-decisions.md`](docs/decisions/open-decisions.md). Review should concentrate on physical fidelity tiers, spectral basis, atmospheric solver family, catalogue/map licensing, browser fallback level, and the boundary between precomputed transfer and interactive source evaluation.

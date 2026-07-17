# Viewer implementation roadmap

## Phase 0 — review and vocabulary

Deliverables:

- review this Viewer plan with Environment Atlas emission/atmosphere and Physics plans;
- approve ownership, two-route product model, scenario identity and display/physics distinction;
- classify every existing UI control and test fixture;
- resolve the high-impact decisions in [`decisions/OPEN_DECISIONS.md`](decisions/OPEN_DECISIONS.md).

Gate: no production code scaffolding until the scientific package maintainers and Viewer review agree on boundary vocabulary.

## Phase 1 — three bounded feasibility experiments

### 1A. Globe layer

Render tiny synthetic emission plus atmospheric surface/column/slice conformance datasets through MapLibre's globe custom-layer path. Prove vertical/time/evidence semantics, projection, numeric picking, tile seams, context restoration, memory accounting and a production-suitable basemap path.

### 1B. Observer product upload

Generate a tiny synthetic HDR sky/star/body descriptor in a worker/Wasm module, transfer it, and render it through a minimal imperative Three.js engine. Prove linear float handling, atomic revision swap, flux tests and disposal.

### 1C. Vercel/Next runtime

Deploy two client-only route bundles to a preview. Prove direct navigation, worker/Wasm URLs and MIME, cache/range behavior, cross-origin-isolated and baseline modes, and no lingering dual render loops.

Gate: publish measured reports. Choose alternatives explicitly if any proof fails.

## Phase 2 — contracts and fixtures

- freeze Viewer-side Environment Atlas domain display contracts and Physics render-product envelope;
- import emission, atmosphere and Physics conformance fixtures;
- implement language-neutral descriptor validators;
- implement URL/scenario state machine and revision cancellation tests;
- define `LayerPlugin`, `GlobeEngine`, `ObserverEngine` and runtime interfaces;
- create the current-to-new parity matrix.

Gate: corrupt, stale and incompatible products fail deterministically; no real global data required.

## Phase 3 — new application shell

- establish reviewed Next.js workspace/package boundaries;
- build accessible shared shell, `/globe` and `/observe` routes;
- add search/coordinates, time, mode, status, details and share state;
- add responsive sheets and non-canvas data access;
- keep engines backed by fixtures.

Gate: complete two-view journey, direct URLs and keyboard flow with fixture renderers.

## Phase 4 — globe vertical slice

- build deterministic emission and atmospheric display-tile prototypes;
- implement worker decode, GPU cache and custom layer;
- implement legend, missing states, query/picking and provenance;
- implement pin card and observer prefetch/transition;
- evaluate PMTiles versus conventional tiles/chunks from measured delivery.

Gate: reviewed emission and atmosphere release subsets render conservatively from globe to local zoom, preserve surface/column/slice/run/evidence semantics, and match authoritative queries.

## Phase 5 — observer vertical slice

- implement ObserverEngine pass/resource structure;
- connect Physics Wasm capability/scenario/product protocol;
- render coarse coherent diffuse sky, stars and bodies;
- add mini-map preview/commit and cancellation;
- implement HDR display transform and an inspector that separates runtime availability, input evidence/validity/uncertainty and numerical fidelity/convergence;
- validate context loss, stale revision and route disposal.

Gate: one end-to-end emission + atmosphere → Physics → Observer scenario passes numeric and visual references, including a polluted-source-to-clean-observer path.

## Phase 6 — physical completeness by product family

Integrate only after each Physics module's validation gate:

1. astronomy/time/reference frames;
2. resolved stars and calibrated diffuse celestial map;
3. Sun, Moon and planetary disks/illumination;
4. Atmosphere Field state adapter, molecular/aerosol/cloud optical closure, refraction and horizon refinement;
5. artificial-light propagation from Environment Atlas emission through a horizontally varying Atmosphere Field;
6. surface BRDF, terrain, Earthshine and multiple-scattering terms;
7. broken-cloud/3-D refinement and spatially varying PSF;
8. coherent refinement and `diagnostics` products.

The exact dependency order remains Physics-owned. The Viewer adds no stand-in equation to unblock a panel.

## Phase 7 — performance and compatibility

- profile non-developer devices and all target browsers;
- tune tiles, route chunks, uploads, caches, DPR and supported quality profiles;
- decide whether Wasm threads and/or OffscreenCanvas provide enough measured benefit;
- complete 20+ route-cycle leak tests;
- validate Vercel production-like caching/headers/assets;
- implement explicit constrained/unsupported experiences.

Gate: budgets and scientific quality reports pass together.

## Phase 8 — additional pollution layers

- implement one non-light layer plugin to prove generality;
- validate different units, temporal support, missing states and query behavior;
- add cross-layer comparison only with reviewed alignment/aggregation rules;
- keep new data outside Physics unless a separate scientific input contract is approved.

Gate: the globe's generality is demonstrated without weakening Light/Atlas semantics.

## Phase 9 — cutover

- run old/new parity and intentional-difference review;
- migrate default application entry;
- publish methodology, attribution and quality language;
- retain or retire the Vite baseline according to validation needs;
- create rollback-compatible Viewer/emission/atmosphere/Physics release manifests.

# Rendering, Wasm, and worker plan

## 1. Technology boundary

WebGL2 is the required GPU renderer. Rust/WebAssembly is the CPU-side scientific and decoding runtime. JavaScript/TypeScript coordinates them and owns browser lifecycle; it is not the place for duplicated radiative-transfer mathematics.

The production coordinator is an independent
[`runtime/browser-worker`](../../../../runtime/browser-worker/README.md) package. The Viewer owns
only its typed client and presentation of runtime state; the existing reference
application's worker remains a behavioral fixture.

Wasm does not automatically accelerate all code. It is justified here for shared native/browser physics, predictable numeric kernels, memory layout, SIMD-capable loops, and removing large calculations from JavaScript. It does not make GPU fragment work faster, eliminate memory transfer cost, or replace careful algorithms.

## 2. Main-thread rule

The main thread may perform:

- React event handling and accessible UI;
- MapLibre and Three.js/WebGL calls, because WebGL context ownership remains there initially;
- small descriptor validation and scheduling;
- bounded buffer uploads;
- semantic status updates.

It must not perform:

- emission/atmosphere cell reconstruction or wide spatial/vertical lookup loops;
- ephemerides/catalogue propagation for full batches;
- atmospheric transfer or PSF kernel construction;
- large JSON parsing/object construction;
- per-star/per-pixel JavaScript/Wasm calls;
- synchronous decompression of scientific assets.

OffscreenCanvas is a later experiment, not the baseline: moving rendering to a worker complicates MapLibre/UI integration, browser debugging, context lifecycle, and accessibility. Adopt it only if profiles show main-thread rendering contention that cannot be solved through ordinary scheduling.

## 3. Coarse ABI

The Worker/Wasm interface exchanges a small number of commands:

```text
capabilities() -> capability_and_revision_ranges
initialize(runtime_manifest, capability_profile) -> engine_handle
open_emission_release(emission_manifest, dictionaries) -> emission_release_handle
open_atmosphere_release(atmosphere_manifest, dictionaries) -> atmosphere_release_handle
register_chunk(release_handle, chunk_descriptor, bytes)
register_environment_products(engine_handle, emission_release_handle, atmosphere_release_handle)
register_physics_asset(engine_handle, manifest_descriptor, bytes) -> asset_handle
submit_observer_scenario(engine_handle, ObserverScenario) -> scenario_revision
plan_observer_products(engine_handle, scenario_revision, view_descriptor) -> plan_handle
step(plan_handle, work_budget) -> progress + zero/more product descriptors
cancel_scenario(engine_handle, scenario_revision)
release_handle(handle)
shutdown(engine_handle)
```

Events:

```text
ready(capabilities_and_compatibility)
progress(scenario_revision, canonical_stage, domain_substage?, completed, total, convergence?)
observer_product(scenario_revision, descriptor, transferable_buffers)
observer_render_product_set_complete(scenario_revision, tier, product_ids)
warning(scenario_revision?, code, details)
failed(scenario_revision?, code, recoverability)
```

`canonical_stage` uses `resolve_inputs`, `load_environment`,
`build_geometry_astronomy`, `build_optical_state`, `solve_transfer`,
`apply_observation`, `publish_products`, or `refine`. Failure `code` uses the
unified top-level categories; Viewer-specific recovery text is derived from the
structured details rather than inventing a second error taxonomy.

This is the canonical coordinator protocol from the unified system contract. The
coordinator maps it to independently versioned Environment decoder and Physics
module ABIs; UI code never calls those exports directly. Descriptors are
schema-versioned and buffers are transferred, not copied. Product descriptors
keep `DataValidity`, convergence/residual, approximation/fidelity and uncertainty
separate; `RuntimeAvailability` is Viewer state derived from events. Wasm
linear-memory views cannot be assumed valid after memory growth; the binding owns
copying or transferring into stable product buffers. Shared memory is optional
and must have explicit ownership/fence rules.

## 4. Scheduling and cancellation

Priority order:

1. input and current camera frame;
2. coarse products for current committed scenario;
3. visible tile/product refinement;
4. explicit inspector queries;
5. likely destination prefetch;
6. background cache warming.

Cancellation is cooperative inside Physics stages and immediate at the coordinator queue. Completed outputs for stale revisions are never uploaded. Cache insertion occurs only for complete, validated products so cancelled work cannot poison reuse.

## 5. WebGL2 resource policy

- Feature-detect required behavior: float renderability, filtering/blending where used, maximum texture sizes, precision and timer-query support.
- Use linear float targets (`RGBA16F` where validated, `RGBA32F` only where error requires) with explicitly tested packed fallbacks.
- Track actual estimated GPU bytes for textures, buffers, render targets, tile caches and transition assets.
- Pool stable allocations and update regions rather than recreate whole scenes.
- Double-buffer complete product families or use an atomic tile-generation registry.
- Cap canvas DPR independently from physical grid resolution.
- Treat context loss as expected: stop uploads, recreate resources from retained descriptors/cache, and report status.
- Dispose every route-owned texture, material, geometry, map layer, event listener and animation callback.

## 6. Avoiding blockiness

Blockiness may come from at least four different resolutions:

1. Environment source/state horizontal, vertical and temporal resolution;
2. Physics angular/source-domain discretization;
3. render-product texture/mesh resolution;
4. canvas/device resolution.

Increasing only canvas DPR can make a coarse physics grid more visibly blocky. The quality controller should choose physical resolution by radiance-gradient/error estimates, with more attention near horizon and bright sources, and use interpolation/reconstruction that is validated in solid angle. Tile borders must cover filters/PSF support.

The inspector reports all four resolutions so “high resolution” is not a single ambiguous setting.

## 7. Frame loop

Each active engine has one scheduler. A frame is requested when:

- camera/interaction changes;
- new complete products are uploaded;
- time is intentionally animating;
- MapLibre requires a repaint;
- a display transform animates;
- diagnostics explicitly sample timing.

Static scenes should settle to no continuous observer render loop. Mini-map repaint is on demand or capped. Background computation progress updates must not force GPU frames unless visible output changes.

## 8. Threads and cross-origin isolation

The baseline uses one module worker with single-threaded Wasm. A threaded Wasm tier may use `SharedArrayBuffer` only when:

- profiling shows a parallelizable Physics bottleneck;
- cross-origin isolation works with every basemap, font, sprite, catalogue and scientific asset;
- memory duplication and worker startup remain within budgets;
- Safari/Chromium/Firefox target testing is complete;
- the single-thread fallback stays correct and supported.

Threads change throughput, not mathematical correctness. Algorithms, convergence and cache design come first.

## 9. Telemetry

Collect privacy-respecting measurements by named capability tier:

- route and runtime download/decode time;
- worker/Wasm initialization;
- first coarse and refined coherent result;
- stage CPU time and cancellation latency;
- frame percentiles, long tasks and upload stalls;
- GPU/CPU memory estimates and eviction;
- WebGL context loss and worker restarts;
- atmosphere selection/fallback, scientific validity/evidence/uncertainty and numerical fidelity/convergence metadata.

Never upload exact observer coordinates without explicit policy/consent; bucket or keep local diagnostics where possible.

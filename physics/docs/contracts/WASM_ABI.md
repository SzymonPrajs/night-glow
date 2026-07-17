# WebAssembly ABI and worker contract

This document defines the desired boundary shape, not final Rust/TypeScript syntax.

The browser application's use of this ABI is described in the independent [Viewer integration contract](VIEWER_CONTRACT.md). Physics owns scenario execution and product semantics; Viewer owns routes, interaction, active render-engine lifetime, and stale-result rejection.

These are Physics-module exports. The Viewer uses the repository's canonical
coordinator-worker protocol instead; the coordinator maps `initialize` to
`create_engine` and routes Environment release operations to their independently
versioned decoders. The Viewer never calls this ABI directly.

## 1. Lifecycle

```text
capabilities() -> `physics_abi_revision`, supported contract revisions, SIMD/threads/memory features
create_engine(config_descriptor) -> engine_handle
register_environment_products(engine_handle,
                              emission_release_handle,
                              atmosphere_release_handle)
register_physics_asset(engine_handle, manifest_descriptor, bytes) -> asset_handle
submit_observer_scenario(engine_handle, ObserverScenario) -> scenario_revision
plan_observer_products(engine_handle, scenario_revision, view_descriptor)
    -> plan_handle
step(plan_handle, work_budget) -> progress + zero/more product descriptors
cancel_scenario(engine_handle, scenario_revision)
release_handle(handle)
```

Calls operate on scenarios, batches, tiles, band blocks, or bounded solver steps. No call exists for “trace one ray” or “transform one star” from JavaScript.

## 2. Descriptors

Small descriptors may use a compact serialization or fixed ABI structure. Large numeric payloads live in contiguous aligned arrays described by offset, length, element type, shape, strides/layout revision, units/basis/frame identifier, ownership/lifetime, and scenario/product revision.

JSON is acceptable for human-facing diagnostics and initial low-frequency configuration if measured overhead is irrelevant. It is not the transport for sky fields, catalogues, LUTs, or kernels.

## 3. Ownership modes

1. **Wasm-owned view:** JavaScript obtains a typed view into stable Wasm memory and uploads/reads before the documented invalidation point.
2. **Transferred output:** worker transfers an owned `ArrayBuffer` to the main thread; sender loses ownership.
3. **Shared memory:** workers and main thread coordinate read-only completed regions plus atomic state when cross-origin isolation and thread support exist.

The API must state whether any operation can grow memory. JavaScript refreshes views after growth. Output publication uses a complete flag/revision written after data, with appropriate atomics in shared mode.

## 4. Worker topology

Baseline:

```text
main/UI/WebGL thread <-> coordinator worker containing Wasm engine
```

Threaded tier:

```text
main/UI/WebGL thread <-> coordinator worker <-> bounded Wasm worker pool
                                      \---- shared linear memory
```

The coordinator owns scheduling and prevents oversubscription. Main-thread work is message handling and GPU upload, never a long solve. Without `SharedArrayBuffer`, use coarse transferable jobs to avoid copies.

## 5. Cancellation and stale work

Every committed `ObserverScenario` receives a Viewer-assigned `scenario_revision`. Jobs check its cancellation token between bounded blocks. Outputs include the revision; main thread and renderer reject stale products. Cancelled computations can release scratch memory but cannot publish to completed caches or overwrite a current tile.

## 6. Progress and failure

Progress contains a canonical parent stage (`resolve_inputs`, `load_environment`, `build_geometry_astronomy`, `build_optical_state`, `solve_transfer`, `apply_observation`, `publish_products`, or `refine`), optional domain substage, completed/estimated work, current LOD/fidelity, numerical residual/error where defined, memory high-water, and newly ready products. It must distinguish “coarse result available” from “target converged.”

Errors use the unified contract's top-level categories and retain structured domain details. Invalid input/unit/frame maps to `invalid_units_or_coordinates`; missing or incompatible assets distinguish `missing_asset`, `incompatible_schema`, and `incompatible_semantics`; capability, numerical, cancellation, memory and internal failures map to `unsupported_capability`, `numerical_non_convergence`, `cancelled`, `resource_exhausted`, and `runtime_failure`. Panics are trapped as `runtime_failure`; they are not the normal control path.

## 7. Cross-origin isolation and Vercel

Wasm threads/`SharedArrayBuffer` generally require cross-origin isolation through suitable `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers. Vercel can configure response headers in project configuration. This affects third-party resources and embedding, so it is an optional deployment tier with an early integration test—not an assumption hidden in code.

## 8. Measurement gates

Before finalizing the ABI, benchmark calls/message count, bytes copied/transferred/shared, Wasm heap and peak scratch, memory-growth events, startup/compile/instantiate, asset decode, cancellation latency, single versus threaded solve, typed-view-to-WebGL upload, and browser/device variance. Architecture is accepted when boundary overhead is a small, measured fraction of solve/upload time.

## 9. Environment Atlas integration

Environment Atlas lookup/decoding and Physics propagation are independently versioned. The preferred browser topology can place conforming decoders in the coordinator worker: the emission decoder writes a contiguous `SurfaceEmissionBatch`, while the atmosphere decoder writes a regional `AtmosphereStateVolume`. Physics consumes both without per-cell or per-sample JavaScript objects. An alternative uses separate Wasm modules and coarse transferable/shared buffers.

`register_environment_products` binds already validated independent release handles; `register_physics_asset` validates Physics-owned manifests. Neither turns `J_DNB` into spectral sources or environmental variables into optical coefficients. Those conversions occur in Physics under explicit source and `atmosphere_optics_model_revision` policies. The browser decoder only performs bounded chunk decode, selection and interpolation; global NWP, assimilation and product fusion remain offline.

The umbrella state contract, source-to-observer volume requirement and atmospheric conformance fixtures are defined in [the Environment Atlas consumer contract](ENVIRONMENT_ATLAS_CONTRACT.md). Detailed emission semantics remain in [the emission contract](EMISSION_RELEASE_CONTRACT.md).

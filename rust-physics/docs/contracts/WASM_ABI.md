# WebAssembly ABI and worker contract

This document defines the desired boundary shape, not final Rust/TypeScript syntax.

## 1. Lifecycle

```text
capabilities() -> versions, SIMD/threads/memory features
create_engine(config_descriptor) -> engine_handle
register_asset(manifest_descriptor, bytes) -> asset_handle
set_scenario(engine_handle, scenario_descriptor) -> revision
plan(engine_handle, revision, view_descriptor) -> plan_handle
step(plan_handle, work_budget) -> progress + zero/more output descriptors
cancel(plan_handle)
release(handle)
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

Every scenario update increments a revision. Jobs check a cancellation token between bounded blocks. Outputs include the revision; main and renderer reject stale products. Cancelled computations can release scratch memory but cannot publish to completed caches or overwrite a current tile.

## 6. Progress and failure

Progress contains stage, completed/estimated work, current LOD/fidelity, numerical residual/error where defined, memory high-water, and newly ready products. It must distinguish “coarse result available” from “target converged.”

Errors are structured: invalid input/unit/frame, missing/incompatible asset, unsupported capability, numerical non-convergence, cancellation, allocation/memory pressure, and internal invariant failure. Panics are trapped and reported; they are not the normal control path.

## 7. Cross-origin isolation and Vercel

Wasm threads/`SharedArrayBuffer` generally require cross-origin isolation through suitable `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers. Vercel can configure response headers in project configuration. This affects third-party resources and embedding, so it is an optional deployment tier with an early integration test—not an assumption hidden in code.

## 8. Measurement gates

Before finalizing the ABI, benchmark calls/message count, bytes copied/transferred/shared, Wasm heap and peak scratch, memory-growth events, startup/compile/instantiate, asset decode, cancellation latency, single versus threaded solve, typed-view-to-WebGL upload, and browser/device variance. Architecture is accepted when boundary overhead is a small, measured fraction of solve/upload time.

# Night Glow coordinator worker — design boundary

This runtime defines the production browser worker that connects the Viewer to
the independently versioned Environment and Physics WebAssembly modules. It is a
runtime and scheduling boundary, not a scientific package.

## Ownership

The worker owns:

- capability discovery and Wasm module loading;
- scenario-scoped handles and immutable request identities;
- coarse chunk and buffer transfer between Environment, Physics, and Viewer;
- bounded scheduling, progress, cancellation, and stale-result rejection;
- explicit buffer lifetime, memory accounting, and structured failures;
- cache coordination without changing scientific cache keys or revision rules.

It does not own physical equations, environmental reconstruction semantics,
WebGL resources, tone mapping, application state, provider downloads, or Vercel
publication jobs. Environment and Physics remain independently testable native
and Wasm packages even if one worker hosts both modules.

## Baseline topology

```mermaid
flowchart LR
  V["Viewer main thread"] <-->|"versioned commands and transferable buffers"| W["Coordinator module worker"]
  W --> E["Environment Wasm decoder/query adapter"]
  W --> P["Physics Wasm solver"]
  E -->|"contiguous source and atmosphere batches"| P
  P -->|"coherent HDR render product set"| W
```

The required baseline is one module worker and non-threaded Wasm. SIMD, Wasm
threads, `SharedArrayBuffer`, and additional workers are capability-gated
accelerators, never correctness requirements. Calls are scenario-, tile-, batch-,
or field-sized; no per-cell, per-star, per-ray, or per-voxel JavaScript loop is
part of the architecture.

## Protocol surface

The canonical command vocabulary and lifecycle live in the
[unified contract](../../packages/contracts/README.md). The first implementation should expose
coarse operations equivalent to:

1. initialize runtime and report capabilities;
2. load and validate immutable release/module manifests;
3. commit or cancel an `ObserverScenario` revision;
4. resolve Environment chunks and build contiguous query products;
5. run bounded Physics stages with progress and cancellation points;
6. return one coherent `ObserverRenderProductSet` or structured failure;
7. release scenario, product, cache, and buffer handles explicitly.

Messages must carry protocol and schema revisions, request and scenario revision,
dependency identities, and transfer ownership. Results from superseded scenarios
are discarded before they can mutate Viewer state.

## Planned package shape

```text
runtime/browser-worker/
├── README.md                 this reviewed boundary
├── src/                      future TypeScript worker host and module adapters
├── tests/                    protocol, cancellation, memory, and browser tests
└── fixtures/                 tiny language-neutral conformance products
```

Do not add placeholder implementation files merely to match this tree. The first
code belongs to the bounded Wasm/transfer feasibility proof in the
[implementation plan](../../implementation/README.md).

Related plans: [Viewer rendering and workers](../../apps/viewer/docs/architecture/rendering-and-workers.md),
[Physics Wasm ABI](../../packages/physics/docs/contracts/wasm-abi.md), and
[Environment format/API](../../packages/environment/docs/emission/format-and-api.md).

# Research: browser, Wasm, WebGL2, and Vercel

## Correct division of labour

- Rust/Wasm: astronomy, physics, asset decode, solver scheduling, and CPU-side construction of radiance products.
- Web Workers: non-blocking execution and optional parallelism.
- WebGL2/Three.js: GPU rasterization, HDR texture sampling/composition, star/body drawing, validated convolution passes, and final display transform.
- TypeScript: UI, network/cache policy, feature detection, messages, and render-resource lifetime.
- Vercel/CDN: immutable static bundles/assets, response headers, caching, and observability—not global scientific precomputation.

Environment emission and atmosphere domains remain independently released even when both decoders and Physics run in one coordinator worker. The efficient paths are coarse contiguous source batches and bounded regional atmospheric volumes, not merging scientific workspaces or sending one message per cell/sample.

[Three.js `WebGLRenderer`](https://threejs.org/docs/pages/WebGLRenderer.html) targets WebGL 2. That is the intended rendering layer for this design. WebGPU is not required. WebGL2 is not a general compute API, so forcing all radiative transfer into fragment shaders would complicate review, portability, and parity; selective GPU passes can be considered after a Rust reference exists.

## Wasm performance questions

The Rust and WebAssembly Book’s discussion of the [JavaScript/Wasm boundary](https://rustwasm.github.io/book/game-of-life/implementing.html) motivates minimizing crossings and exposing bulk memory rather than per-cell calls. The project must measure, rather than assume:

- scalar `f64`/`f32` versus SIMD throughput;
- Rust allocation and memory-growth behavior;
- catalogue/LUT decode and resident-set peaks;
- worker message/copy/transfer costs;
- shared-memory scheduling overhead;
- native versus Wasm numerical parity;
- main-thread GPU upload cost after solve;
- browser-specific compilation/startup.

Wasm accelerates complex CPU mathematics when the workload is sufficiently large and regular. It will not improve WebGL rasterization, network bytes, a poor algorithm, or an under-resolved model. The native precompute target is often the larger performance win because it removes repeated global work from every client.

## Threads and isolation

Threaded Wasm and `SharedArrayBuffer` generally require a cross-origin-isolated document. MDN documents the role of [Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy); deployment also needs compatible embedder/resource policy. [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json) supports response headers.

Research tasks:

- test `crossOriginIsolated`, `SharedArrayBuffer`, Wasm threads, and SIMD in the actual production bundle;
- audit every cross-origin font/image/script/data request under the chosen embedder policy;
- decide whether the app must be embeddable in another site;
- implement and benchmark a single-worker transferable-buffer fallback;
- cap worker count using measured workload/device behavior, not logical cores alone;
- verify response headers on preview and production deployments.

## WebGL2 quality/performance

Research required extensions and fallbacks for floating render targets, float filtering/blending, texture arrays, instancing, and timer queries. Test actual operations because support combinations differ.

GPU quality work includes device-pixel-aware canvas sizing; linear HDR intermediates; sufficient physical texture/mesh LOD; stable batched stars; projection/solid-angle-correct sampling; tile borders; PSF kernel normalization; one tone-map stage; and resource/memory accounting.

“High resolution” has three independent meanings: solved physical resolution, stored asset resolution, and display framebuffer resolution. All three need diagnostics. A Retina framebuffer displaying a 22-row physical horizon solve can still reveal interpolation/blocking.

## Vercel asset strategy

- publish content-addressed immutable binary tiles/LUTs and manifests;
- range/tile requests rather than a monolithic global download;
- long-lived caching for hashed assets and short-lived pointers/manifests;
- never perform raw Gaia/ERA5/CAMS/VIIRS preprocessing or forecast fusion in request-time functions;
- budget cold bundle/Wasm startup and first coherent result separately from full refinement;
- use deployment revisions so HTML/Wasm/data schemas cannot mismatch;
- add numeric smoke tests and browser performance probes to preview verification;
- preserve a non-threaded tier if cross-origin policy or device constraints fail.

## Device matrix

At minimum test recent Chromium, Firefox, and Safari on Apple Silicon and representative integrated/mobile/older hardware. Record WebGL capability profile, pixel ratio, GPU/CPU memory pressure, Wasm SIMD/threads, cold/warm load, first result, refinement, frame/GPU time, cancellation, tab background/restore, and graceful fallback. A powerful development Mac is the reference workstation, not the production performance envelope.

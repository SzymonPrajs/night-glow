# Open Viewer decisions

## Must resolve before implementation scaffolding

1. What exact package/workspace boundary lets the Next Viewer coexist with the current Vite app during migration?
2. Which current controls/tests represent trusted behavior, placeholder physics, or display-only effects?
3. What is the first version of the Physics render-product schema and coherent barrier?
4. What independent emission and atmospheric display products preserve intended surface/column/slice quantities across globe LODs?
5. What height datum and astronomy time metadata are required in shareable scenarios?

## Must resolve through feasibility experiments

1. Does MapLibre custom-layer globe rendering meet projection, HDR, picking and resource-lifecycle needs?
2. Are conventional tiles, PMTiles, or another chunk format best for emission and atmosphere display/query products?
3. Does Next.js impose material worker/Wasm/bundle costs compared with Vite?
4. Which HDR texture formats and filtering/blending operations work reliably on the browser matrix?
5. Can all production basemap/scientific assets work under COOP/COEP?
6. Does Wasm threading outperform a single worker enough to justify isolation and memory cost?
7. Is OffscreenCanvas necessary after main-thread profiling?

## Must resolve before visual design freeze

1. Globe/Sky terminology and primary mode switch placement.
2. Timezone, animation and preview/commit behavior.
3. Legend normalization, missing states and uncertainty language.
4. Desktop/mobile sheet and mini-map behavior.
5. Scientific inspector scope and provenance export.
6. Accessibility alternative for canvas-only spatial exploration.

## Must resolve before production data

1. Production basemap provider/self-hosting, licence and attribution.
2. Object storage/CDN and range/cache behavior.
3. Emission/atmosphere/Physics data licence compatibility with browser delivery and operational update redistribution.
4. Which external scheduler/storage publishes immutable atmospheric forecast runs and advances channels atomically?
4. Exact-coordinate analytics/privacy policy.
5. Default release manifest, rollback and long-term URL reproducibility.

## Explicitly deferred

- WebGPU renderer/compute backend.
- Photorealistic 3-D terrain and Cesium migration.
- Server-side generation of observer sky products.
- Real-time multi-user collaboration.
- General cross-pollutant causal analysis.
- Native mobile wrappers.

Deferral means the first architecture leaves a clean contract boundary, not that placeholder implementations should be added.

# Framework and globe research notes

## Application framework

The application shell must be evaluated separately from the rendering engines. Next.js does not accelerate WebGL or Physics; it supplies product routing, loading boundaries, static content and deployment structure. The proposed pattern follows official guidance:

- Server Components for static shell/content where useful; [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components).
- Narrow browser entry boundaries through [`use client`](https://nextjs.org/docs/app/api-reference/directives/use-client).
- Client-only dynamic imports for browser APIs through [lazy loading](https://nextjs.org/docs/app/guides/lazy-loading).
- App Router layouts/pages following the [project structure](https://nextjs.org/docs/app/getting-started/project-structure).

Vite remains a valid comparison baseline; its official [static deployment guidance](https://vite.dev/guide/static-deploy) makes it appropriate for a pure SPA. The feasibility report should compare route chunks, worker/Wasm imports, cold startup, dev ergonomics and Vercel behavior using the same tiny render proof.

## Globe engine

MapLibre's documented TypeScript/WebGL map engine, globe support and `CustomLayerInterface` fit the thematic map problem. Its custom layer shares the map's GL context, so experiments must explicitly test GL-state restoration, depth/blending, globe projection matrices, tile lifecycle, context loss and compatibility across MapLibre upgrades.

Primary references:

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [CustomLayerInterface](https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/)
- [Custom layer on a globe](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-simple-custom-layer-on-a-globe/)
- [Raster tile source example](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-raster-tile-source/)

CesiumJS is the main alternative. Its [imagery layers](https://cesium.com/learn/cesiumjs-learn/cesiumjs-imagery/) and [Globe API](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html) are strong when terrain/globe/3-D geospatial primitives dominate. The proof should score both only against requirements, not build two production paths.

## UI layer

Use React for accessible controls and product state, with headless primitives where they reduce accessibility risk. A shadcn/Radix-style source-owned component approach is compatible, but the specific library is deferred until the UI wireframes exist. CSS variables/design tokens should own theme; utility CSS is optional. No UI kit owns camera or render-loop state.

## Rendering layer

Three.js remains a useful WebGL2 resource/scene abstraction for observer output. The decision is not an endorsement of the current 1,500-line component. The new renderer is an imperative engine with explicit passes, product schemas, allocation accounting and context recovery.

React Three Fiber is not selected because it would place the scientific render graph inside React reconciliation conventions without a demonstrated benefit. Raw WebGL2 remains available inside specialized passes, and WebGPU can later implement the same product interface.

## Data delivery

Global scientific data must be tiled/chunked and immutable. PMTiles' [MapLibre integration](https://docs.protomaps.com/pmtiles/maplibre) makes it a candidate for range-served thematic products, but experiments must compare first-view bytes, cache efficiency, update granularity, parallelism and hosting behavior against ordinary tiles.

## Research conclusion

The proposed stack is coherent, but acceptance is conditional. Framework, map engine, tile packaging and threads each have a bounded proof and measurable rejection criterion in the roadmap. None changes the ownership rule: Atlas reconstructs sources, Physics computes observer radiance, Viewer renders and interacts.


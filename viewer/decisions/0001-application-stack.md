# Decision 0001: application and rendering stack

**Status:** proposed for review
**Scope:** new Viewer only; does not restructure Environment Atlas emission domain or Physics

## Decision

Use:

- **Next.js App Router + React + TypeScript** for the application shell and routes;
- **MapLibre GL JS** for the globe and observer mini-map;
- **MapLibre custom WebGL layer** for the light-emission overlay;
- **imperative Three.js over WebGL2** for the observer renderer;
- **Rust/WebAssembly in module workers** for Physics and Atlas decoding/adaptation;
- **small external product state + URL state**, with frame state private to engines;
- **Vercel** for the application deployment and CDN/object storage for immutable scientific assets.

## Context

The current Vite/React/Three/Leaflet app proves browser rendering and worker use but is a single observer screen with scientific orchestration in React and a monolithic renderer. The new product requires two shareable, independently loaded GPU views, global thematic mapping, future pollution layers, a reviewed Wasm boundary, static methodology content and a Vercel deployment path.

## Why this stack

### Next.js over a new Vite SPA

Next.js adds route/layout boundaries, static content and metadata, loading/error boundaries, future saved/share APIs and first-class Vercel operation. Its server features do not own scientific compute. Heavy browser engines remain dynamic client-only islands.

Vite would remain the simpler choice for a permanently pure single-page visualization with no product routes/content/server-facing trajectory. It remains the fallback if the feasibility deployment shows a material worker/Wasm/WebGL integration or bundle disadvantage.

### MapLibre over Leaflet

Leaflet's 2-D raster map is not the desired planet view. MapLibre supplies globe projection, vector styling, labels, picking, custom GL layers and a consistent mini-map engine.

### MapLibre over CesiumJS

MapLibre better matches a thematic pollution-map product with familiar map layers, 2-D/3-D behavior and a small local mini-map. CesiumJS becomes preferable if photorealistic terrain, 3D Tiles, orbital/space geometry or volume rendering becomes central. Record that trigger rather than mixing both engines now.

### Imperative Three.js over React Three Fiber

The observer is a versioned HDR product renderer with large buffer/texture updates and specialized passes. Keeping an imperative engine outside React reduces frame-state coupling and makes resource lifetime explicit. React Three Fiber may be reconsidered for isolated decorative scenes, not as the scientific renderer owner.

### WebGL2 baseline over WebGPU requirement

WebGL2 has the required browser reach and matches current experience. WebGPU can be evaluated later behind the same renderer product contract. It is not assumed for every browser and is not required for scientific computation, which remains in Rust/Wasm/native code.

## Consequences

- Two substantial client bundles and render engines must be managed deliberately.
- Only one full-rate engine stays active; transition and mini-map budgets are explicit.
- Next.js SSR does not apply to WebGL surfaces; direct routes need meaningful loading/fallback UI.
- Cross-origin isolation for Wasm threads constrains basemap and asset providers.
- A deterministic Atlas display product is likely needed in addition to its scientific lookup format.
- UI developers cannot import Physics functions for convenience.
- Viewer, emission, atmosphere and Physics compatibility requires one handshake over their independent revisions and fixtures.

## Required proof before acceptance

1. MapLibre custom layer on globe with correct numeric picking and context recovery.
2. Worker/Wasm float-product transfer into a minimal Three observer renderer.
3. Next.js/Vercel two-route build with isolated bundles, correct headers/assets and full disposal.
4. Comparative measurements against a minimal Vite build for startup, bundles and worker/Wasm ergonomics.

The decision becomes accepted only after these reports, not merely after scaffolding.

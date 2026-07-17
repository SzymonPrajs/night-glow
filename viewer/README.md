# Night Glow viewer — design workspace

This folder defines the application that presents Night Glow's scientific products. It is a documentation-first project: no new viewer implementation should begin until the routes, ownership boundaries, data contracts, performance budgets, and migration gates described here have been reviewed.

The product has two first-class views:

1. **Globe** — inspect light emitted from Earth's surface, then later other pollution layers, at planetary-to-local scales.
2. **Observer** — enter the physically rendered sky at a selected place and time, with a small map for local relocation.

The Viewer is independent from both scientific projects:

- [`../environment-atlas`](../environment-atlas/README.md) reconstructs independently versioned calibrated surface-emission and four-dimensional atmospheric-state releases.
- [`../physics`](../physics/README.md) computes astronomy, atmospheric transport, celestial illumination, PSF products, and observer-space radiance.
- `viewer/` owns interaction, navigation, GPU resource lifetime, display transforms, accessibility, and deployment. It owns no scientific law.

## Start here

1. [Unified system contract](../docs/system-contract.md) — canonical products, scenario, evidence, lifecycle and revisions.
2. [Architecture](ARCHITECTURE.md) — application, renderer, worker, and ownership boundaries.
3. [User experience](USER_EXPERIENCE.md) — the unified two-view product and UI leaf pass.
4. [Globe view](GLOBE_VIEW.md) and [Observer view](OBSERVER_VIEW.md) — view-specific plans.
5. [Data contracts](DATA_CONTRACTS.md) — Environment Atlas domain → Viewer and Physics → Viewer interfaces.
6. [State and navigation](STATE_AND_NAVIGATION.md) — URLs, scenario identity, transitions, and stale-result rules.
7. [Rendering and workers](RENDERING_AND_WORKERS.md) — WebGL2, Wasm, threading, and frame ownership.
8. [Performance budgets](PERFORMANCE_BUDGETS.md) and [Vercel deployment](VERCEL_DEPLOYMENT.md).
9. [Migration](MIGRATION_FROM_CURRENT_APP.md), [validation](VALIDATION.md), [roadmap](ROADMAP.md), and [TODO](TODO.md).
10. [Application stack decision](decisions/0001-application-stack.md) and [open decisions](decisions/OPEN_DECISIONS.md).

## Settled direction

- Build a new application shell rather than expanding the current single-screen component tree.
- Use Next.js App Router, React, and TypeScript for the application layer, with the two GPU experiences as dynamically loaded client-only routes.
- Use MapLibre GL JS for the globe and mini-map; use a custom WebGL layer for calibrated emission display.
- Use an imperative Three.js/WebGL2 renderer for the observer sky, isolated from React.
- Run Environment Atlas emission/atmosphere decoding and Physics Wasm off the main thread. Cross the JavaScript/Wasm boundary with coarse, versioned messages and transferable buffers.
- Keep only one full-rate GPU view active. A transition may prewarm the destination, but it must not leave two unconstrained render loops alive.
- Keep scientific radiance separate from exposure, palette, tone mapping, and artistic presentation.
- Treat WebGL2 and a single Wasm worker as the required baseline. Threads, `SharedArrayBuffer`, and higher GPU tiers are optional accelerators.
- Store shareable scientific state in the URL and internal renderer state outside React.
- Deploy the application shell on Vercel; serve large immutable scientific releases and tiles from CDN/object storage, never through request-time functions.

## Proposed project boundary

```text
viewer/
├── app/                 future Next.js routes and layouts
├── components/          future accessible product controls
├── engines/
│   ├── globe/           MapLibre adapter and custom layers
│   └── observer/        imperative Three.js/WebGL2 engine
├── runtime/
│   ├── environment/     independent emission/atmosphere decoder clients
│   ├── physics/         Physics Wasm client
│   └── workers/         scheduling and cancellation
├── state/               URL and low-frequency product state
├── docs (this phase)    the files in this directory
└── tests/               future interaction, visual, and contract tests
```

That tree is a proposed implementation boundary, not permission to create placeholder code. This phase should end in reviewable decisions and small feasibility experiments.

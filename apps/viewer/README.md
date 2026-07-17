# Night Glow Viewer — design workspace

This folder defines the application that presents Night Glow's scientific products. It is a documentation-first project: no new viewer implementation should begin until the routes, ownership boundaries, data contracts, performance budgets, and migration gates described here have been reviewed.

The product has two first-class views:

1. **Globe** — inspect light emitted from Earth's surface, then later other pollution layers, at planetary-to-local scales.
2. **Observer** — enter the physically rendered sky at a selected place and time, with a small map for local relocation.

The Viewer is independent from both scientific projects:

- [Environment](../../packages/environment/README.md) reconstructs independently versioned calibrated surface-emission and four-dimensional atmospheric-state releases.
- [Physics](../../packages/physics/README.md) computes astronomy, atmospheric transport, celestial illumination, PSF products, and observer-space radiance.
- [The coordinator worker](../../runtime/browser-worker/README.md) owns asynchronous Wasm scheduling and buffer lifetime.
- `apps/viewer/` owns interaction, navigation, GPU resource lifetime, display transforms, accessibility, and deployment. It owns no scientific law.

## Start here

1. [Unified system contract](../../packages/contracts/README.md) — canonical products, scenario, evidence, lifecycle and revisions.
2. [Architecture](docs/architecture/overview.md) — application, renderer, worker, and ownership boundaries.
3. [User experience](docs/product/user-experience.md) — the unified two-view product and UI leaf pass.
4. [Globe view](docs/product/globe.md) and [Observer view](docs/product/observer.md) — view-specific plans.
5. [Data contracts](docs/architecture/data-contracts.md) — Environment → Viewer and Physics → Viewer interfaces.
6. [State and navigation](docs/architecture/state-and-navigation.md) — URLs, scenario identity, transitions, and stale-result rules.
7. [Rendering and workers](docs/architecture/rendering-and-workers.md) — WebGL2, Wasm, threading, and frame ownership.
8. [Performance budgets](docs/architecture/performance-budgets.md) and [Vercel deployment](docs/delivery/vercel-deployment.md).
9. [Migration](docs/delivery/migration-from-reference.md), [validation](docs/delivery/validation.md), [roadmap](docs/delivery/roadmap.md), and [TODO](docs/delivery/todo.md).
10. [Application stack decision](docs/decisions/0001-application-stack.md) and [open decisions](docs/decisions/open-decisions.md).

## Settled direction

- Build a new application shell rather than expanding the current single-screen component tree.
- Use Next.js App Router, React, and TypeScript for the application layer, with the two GPU experiences as dynamically loaded client-only routes.
- Use MapLibre GL JS for the globe and mini-map; use a custom WebGL layer for calibrated emission display.
- Use an imperative Three.js/WebGL2 renderer for the observer sky, isolated from React.
- Run Environment decoding and Physics Wasm through the separate coordinator-worker package. Cross the JavaScript/Wasm boundary with coarse, versioned messages and transferable buffers.
- Keep only one full-rate GPU view active. A transition may prewarm the destination, but it must not leave two unconstrained render loops alive.
- Keep scientific radiance separate from exposure, palette, tone mapping, and artistic presentation.
- Treat WebGL2 and a single Wasm worker as the required baseline. Threads, `SharedArrayBuffer`, and higher GPU tiers are optional accelerators.
- Store shareable scientific state in the URL and internal renderer state outside React.
- Deploy the application shell on Vercel; serve large immutable scientific releases and tiles from CDN/object storage, never through request-time functions.

## Proposed project boundary

```text
apps/viewer/
├── app/                 future Next.js routes and layouts
├── components/          future accessible product controls
├── engines/
│   ├── globe/           MapLibre adapter and custom layers
│   └── observer/        imperative Three.js/WebGL2 engine
├── runtime/             thin client for runtime/browser-worker; no scientific modules
├── state/               URL and low-frequency product state
├── docs/
│   ├── product/         globe, observer, and end-to-end experience
│   ├── architecture/    data, state, rendering, worker, and performance boundaries
│   ├── delivery/        migration, validation, roadmap, TODO, and Vercel
│   ├── decisions/       application architecture decisions
│   └── research/        bounded framework and rendering investigations
└── tests/               future interaction, visual, and contract tests
```

That tree is a proposed implementation boundary, not permission to create placeholder code. This phase should end in reviewable decisions and small feasibility experiments.

# Night Glow Viewer

The production application that presents Night Glow's scientific products: a
Next.js (App Router) + React + TypeScript shell with two first-class views.

1. **Globe** (`/globe`) — inspect light emitted from Earth's surface (and later
   other pollution layers) at planetary-to-local scales. MapLibre globe with
   typed cell layers built from Environment display products, a layer dock with
   legends, and a place card that leads into the sky.
2. **Sky** (`/observe`) — the physically rendered sky at a selected place and
   time. A raw-WebGL2 renderer samples the observer render product; scenario
   commits run through the coordinator worker with staged progress, retain the
   previous coherent sky on failure, and fail closed rather than fabricate a
   sky. A mini-map handles local relocation; exposure and enhance controls are
   explicitly display-only and never rerun physics.

## Current status

The Viewer is implemented as a **synthetic contract fixture slice**: every
surface is wired to the real contracts, coordinator protocol, and Wasm worker,
but the scientific inputs are one small synthetic fixture — one atmosphere
state (`standard scenario`, one valid time `2024-01-15T00:00:00Z`), a coarse
emission grid, and a tiny render product. Requests outside the fixture fail
closed with an explicit reason and a recovery path. Nothing here is a
calibrated sky prediction yet; see the repository
[implementation status](../../implementation/STATUS.md).

The bounded feasibility experiments under `experiments/` remain as design
evidence only; they are not part of the application. The Vite
[reference viewer](../reference-viewer/README.md) remains runnable as the
behavioral baseline but is no longer what `make dev` serves.

## Run it

```bash
make setup            # once: installs dependencies and builds the Rust crates
make rust-wasm        # once: builds the Environment/Physics Wasm modules
make dev              # serves this app (Next.js) — /globe and /observe
make viewer-e2e-test  # Playwright smoke suite against the built app
```

The Sky view loads Environment/Physics Wasm through the coordinator worker;
`make rust-wasm` must have run at least once (it is also part of
`make build`). Without the Wasm artifacts the view fails closed with a
`missing_asset` explanation instead of a sky.

## Ownership

- [Environment](../../packages/environment/README.md) reconstructs
  independently versioned calibrated surface-emission and four-dimensional
  atmospheric-state releases.
- [Physics](../../packages/physics/README.md) computes astronomy, atmospheric
  transport, celestial illumination, PSF products, and observer-space radiance.
- [The coordinator worker](../../runtime/browser-worker/README.md) owns
  asynchronous Wasm scheduling and buffer lifetime.
- `apps/viewer/` owns interaction, navigation, GPU resource lifetime, display
  transforms, accessibility, and deployment. It owns no scientific law, and it
  never recomputes physics for display-only changes.

## Design documents

The direction below was settled before implementation and still governs it:

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
- Use an imperative WebGL2 renderer for the observer sky, isolated from React.
- Run Environment decoding and Physics Wasm through the separate coordinator-worker package. Cross the JavaScript/Wasm boundary with coarse, versioned messages and transferable buffers.
- Keep only one full-rate GPU view active. A transition may prewarm the destination, but it must not leave two unconstrained render loops alive.
- Keep scientific radiance separate from exposure, palette, tone mapping, and artistic presentation.
- Treat WebGL2 and a single Wasm worker as the required baseline. Threads, `SharedArrayBuffer`, and higher GPU tiers are optional accelerators.
- Store shareable scientific state in the URL and internal renderer state outside React.
- Deploy the application shell on Vercel; serve large immutable scientific releases and tiles from CDN/object storage, never through request-time functions.

## Project boundary

```text
apps/viewer/
├── src/
│   ├── app/               Next.js routes: /globe, /observe, /about, /methodology
│   ├── components/
│   │   ├── shell/         top bar, mode switch, status pills, inspector, sharing
│   │   ├── globe/         MapLibre globe engine, layer dock, place card
│   │   └── observe/       WebGL2 sky engine, time bar, display controls, mini-map
│   └── lib/
│       ├── contracts/     contract types mirrored from packages/contracts
│       ├── fixtures/      synthetic fixture client (the slice's only data source)
│       ├── scenario/      URL state and scenario identity
│       ├── status/        runtime/science status model
│       └── worker/        thin coordinator-worker client; no scientific modules
├── public/                synced Wasm and fixture assets (generated, uncommitted)
├── scripts/               asset sync for dev/build
├── tests/                 unit tests plus the Playwright e2e smoke suite
├── docs/                  product, architecture, delivery, decisions, research
└── experiments/           bounded feasibility evidence (not part of the app)
```

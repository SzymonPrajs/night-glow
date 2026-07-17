# Night Glow reference viewer

This is the existing runnable TypeScript/Vite application, preserved as a
behavioral, visual, and performance baseline while the production architecture is
built. It is self-contained and is not the proposed package boundary.

## Run and verify

```bash
npm ci
npm run dev
```

Use `npm run build` and `npm run lint` for the normal production and source
checks. The package scripts also include deterministic physics, calibration,
weather, PSF, appearance, and Playwright checks; inspect `package.json` for the
complete list.

The equations, calibration, cache behavior, and known limitations are documented
in [the physical glow model](docs/physical-glow-model.md).

## Architectural status

The TypeScript calculation modules and
[`physicalGlow.worker.ts`](src/workers/physicalGlow.worker.ts) are fixtures to
measure and reproduce, not code to lift wholesale into the production system.
The new design keeps each physical calculation in
[Physics](../../packages/physics/README.md), environmental reconstruction in
[Environment](../../packages/environment/README.md), browser orchestration in the
[coordinator worker](../../runtime/browser-worker/README.md), and WebGL rendering in the
[Viewer](../viewer/README.md).

Changes to this application should keep it runnable until the replacement passes
the corresponding numerical, visual, interaction, and browser-performance gates.

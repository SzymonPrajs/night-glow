# Viewer review and implementation TODO

This is a living checklist. An unchecked item is not an implicit implementation decision.

## Product and UI

- [ ] Review Globe/Sky naming with users.
- [ ] Produce low-fidelity layouts for desktop, tablet and phone.
- [ ] Specify location search/geocoding provider, privacy and offline behavior.
- [ ] Decide default time behavior and UTC/local communication.
- [ ] Define the pin preview card and globe-to-sky transition.
- [ ] Define mini-map preview/commit timing for mouse and touch.
- [ ] Classify every current control: physical, display, diagnostic or remove.
- [x] Establish shared `DataValidity`, domain-status and `RuntimeAvailability` vocabulary; design its final legend treatment.
- [ ] Design scientific inspector without exposing it as the default UI.
- [ ] Define reduced-motion and keyboard interaction specifications.
- [ ] Provide non-canvas access to queried values and current sky status.
- [ ] Decide saved locations/scenarios scope and privacy policy.

## Framework and application shell

- [ ] Run Next.js versus Vite integration proof with measured bundles/startup.
- [ ] Select stable Next.js/React versions at implementation time.
- [ ] Decide monorepo/package placement without moving scientific workspaces.
- [ ] Define server/client component boundaries and dynamic viewer entries.
- [ ] Define error/loading boundaries and direct-route fallback.
- [ ] Choose small external state mechanism or `useSyncExternalStore` adapter.
- [ ] Choose accessible headless UI primitives and styling/token strategy.
- [ ] Define URL schema, compatibility and share-manifest evolution.

## Globe

- [ ] Build MapLibre custom-layer feasibility experiment.
- [ ] Compare MapLibre and Cesium against explicit terrain/3D Tiles criteria.
- [ ] Select production vector basemap/style and confirm licence/attribution.
- [ ] Define independent emission and atmosphere display-tile builds and conservation/aggregation rules.
- [ ] Define atmospheric surface, column, altitude-slice/profile, valid-time, forecast-lead, climatology and uncertainty controls.
- [ ] Ensure displayed PM/AOD/humidity/cloud tiles never masquerade as the full Physics state volume.
- [ ] Evaluate PMTiles against conventional tiled/chunked delivery.
- [ ] Specify tile format, compression, range behavior and worker decoder.
- [ ] Validate antimeridian, poles, seams and picking.
- [ ] Define fixed/log/percentile normalization language.
- [ ] Define `LayerPlugin` version 1 using light emission.
- [ ] Test one non-light layer before freezing the generic interface.

## Observer renderer

- [ ] Split current `SkyCanvas` behaviors into accepted/rejected fixture inventory.
- [ ] Specify ObserverEngine/pass interfaces and GPU product registry.
- [ ] Freeze initial Physics render-product schema with fixture buffers.
- [ ] Select HDR targets and packed fallbacks by error tests.
- [ ] Define camera projection and sky-radiance texture projection.
- [ ] Define star batch/LOD/flux invariants.
- [ ] Define calibrated Milky Way/diffuse-map streaming and PSF path.
- [ ] Define finite Sun/Moon/planet disk and halo separation.
- [ ] Define surface/terrain/horizon composition path.
- [ ] Define PSF basis upload, normalization and border rules.
- [ ] Define coherent barriers and atomic replacement.
- [ ] Implement explicit artistic bloom separation or omit bloom.
- [ ] Prove context loss and complete disposal.

## Wasm and workers

- [ ] Align Viewer runtime protocol with Physics Wasm ABI.
- [ ] Define separate emission/atmosphere decoder/display and Physics-provider adapters.
- [ ] Decide whether Environment decoders and Physics Wasm share one coordinator worker or separate workers after profiling.
- [ ] Benchmark regional atmosphere chunk decode, vertical interpolation, buffer handoff and cache eviction independently from Physics.
- [ ] Define buffer ownership, memory growth and release rules.
- [ ] Implement cancellation checks and stale-buffer disposal tests.
- [ ] Define worker progress vocabulary from Physics DAG.
- [ ] Benchmark single worker before enabling Wasm threads.
- [ ] Test SIMD/browser compatibility and deterministic fallbacks.
- [ ] Evaluate OffscreenCanvas only after main-thread profiles.

## Contracts and scientific integrity

- [x] Approve Environment direct-to-globe display versus scientific releases-through-Physics paths; display products never feed Physics.
- [ ] Freeze quantity/unit/frame/time fields for all descriptors.
- [ ] Define explicit height datum and astronomy time-scale metadata.
- [ ] Import independent emission/atmosphere conformance fixtures and Physics tiny render fixtures.
- [ ] Define Viewer/emission/atmosphere/Physics compatibility handshake.
- [ ] Preserve `AtmosphereSelectionMode`, `SourceEvidenceClass`, source run/analysis/valid/lead/member or climatology/standard identity, observation-correction and climatology-model revisions, vertical support, `DataValidity` and uncertainty through URL, query and observer scenario.
- [ ] Label climatology/standard scenarios distinctly from forecasts and never imply false street-scale precision.
- [ ] Ensure no double temporal, satellite, BRDF, PSF or tone-map correction.
- [ ] Define separate uncertainty, provider-QA, validity, fidelity and convergence displays without implying false precision.
- [ ] Define provenance download/export.

## Performance

- [ ] Select target device/browser matrix and acquire real measurements.
- [ ] Set route JS, Wasm and first-view data budgets after proofs.
- [ ] Set per-tier CPU/GPU/Wasm/cache memory budgets.
- [ ] Set coarse/refined error targets with Physics.
- [ ] Instrument owned memory, frame time, long tasks and stage timing.
- [ ] Prove on-demand rendering for stable views.
- [ ] Prove route bundle separation and intent-based prefetch.
- [ ] Run repeated globe ↔ observer leak test.
- [ ] Define adaptive degradation and unsupported messaging.

## Vercel and operations

- [ ] Decide object storage/CDN for scientific payloads.
- [ ] Validate Wasm MIME, compression, range and immutable caching.
- [ ] Configure and test COOP/COEP deployment profile.
- [ ] Audit every tile/font/sprite/data source for CORS/CORP.
- [ ] Keep large payloads and Physics compute out of Functions.
- [ ] Define release/default manifests and independent rollback.
- [ ] Define an external Environment forecast publication job and atomic immutable run channel; do not fetch/process provider archives through Vercel Functions or the browser.
- [ ] Define preview deployment conformance dataset.
- [ ] Ensure analytics omit exact coordinates.
- [ ] Document offline/cache/quota behavior.
- [ ] Define telemetry retention and consent.

## Validation and migration

- [ ] Freeze trusted current numeric, interaction and visual fixtures.
- [ ] Mark placeholder-model tests so parity is not mistaken for truth.
- [ ] Build current-to-new capability parity matrix.
- [ ] Add URL/state/contract/unit tests.
- [ ] Add numeric GPU probes and fixed visual regression suite.
- [ ] Add rapid-update, worker-failure and WebGL-context-loss E2E tests.
- [ ] Add keyboard, screen-reader, colour and reduced-motion review.
- [ ] Report results on non-developer hardware.
- [ ] Keep old app runnable until cutover gates pass.
- [ ] Remove duplicated TypeScript physics only after Wasm parity and review.

# Vercel deployment plan

## 1. Deployment shape

Deploy the Next.js application shell to Vercel. Render marketing/methodology content statically and keep the two viewer routes browser-driven. Scientific computation runs in the user's worker/Wasm runtime. Large Environment Atlas emission/atmosphere, catalogue, LUT, terrain and derived display products live in content-addressed object storage behind a CDN.

Vercel Functions are not part of the interactive physics path. They may later handle small manifests, saved share scenarios, authentication or metadata, but they should not proxy global tiles or execute atmospheric solvers.

## 2. Why Next.js here

The current Vite SPA remains a good prototype baseline. The new product benefits from:

- shareable globe/observer routes and route-specific bundles;
- a persistent accessible shell and static explanatory pages;
- metadata, error/loading boundaries and future saved/shareable scenarios;
- strong Vercel integration without moving the GPU/physics runtime server-side.

The heavy viewers remain Client Components and should be loaded with `next/dynamic` and `ssr: false`. Keep `'use client'` at narrow entry boundaries; it is not an instruction to make the whole tree client-rendered. Use the current patched stable Next.js and React versions at implementation time, not a canary solely for novelty.

Official references:

- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [`use client` directive](https://nextjs.org/docs/app/api-reference/directives/use-client)
- [Lazy loading and `next/dynamic`](https://nextjs.org/docs/app/guides/lazy-loading)
- [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure)

## 3. Static versus runtime rendering

The initial viewer can be mostly statically rendered even on normal Vercel Next deployment. Do not lock into full static export until testing confirms it does not impede required headers, route behavior, saved scenarios, or future API needs. If pure static export is selected, document unsupported Next features and test direct navigation to all routes. See [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports).

## 4. Asset layout

```text
app deployment
  HTML, route JS/CSS, worker bootstrap, small manifests

scientific asset CDN/object storage
  /environment/emission/{emission_release_id}/{content_hash}...
  /environment/atmosphere/{atmosphere_release_id}/{source_run_or_climatology_id}/{content_hash}...
  /environment-display/{environment_display_product_id}/{z}/{x}/{y}...
  /physics/{physics_data_manifest_id}/{content_hash}...
  /catalogues/{release}/{tile}...
  /terrain/{release}/{tile}...
  /wasm/{abi}/{content-hash}.wasm
```

Small release manifests use short revalidation and point to immutable hashed payloads. Hashed assets use long-lived immutable caching. Avoid overwriting content at a stable “latest” payload URL.

Operational atmospheric updates are produced outside the Vercel request path by the Environment Atlas native pipeline. It fetches licensed provider data on its own schedule, validates and publishes an immutable run manifest, then atomically advances a small default channel after compatibility checks. A channel is only a mutable pointer: the Viewer resolves it before committing `ObserverScenario`, whose release/run/model IDs—and any reproducible share payload—remain immutable. The browser does not call CAMS/ERA5/GFS archives directly: that would expose provider-specific formats/licence behavior, destroy reproducibility, and make global binary processing a client concern. Historical reanalysis and climatology releases change slowly and receive separate channels from live forecasts.

Vercel cache behavior must be tested using actual response headers and CDN cache status; see [Vercel Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers) and [CDN cache](https://vercel.com/docs/caching/cdn-cache).

## 5. Required headers and MIME types

Wasm responses require the correct `application/wasm` content type. Workers, range requests, compression, CORS and cache headers need deployment tests.

Threaded Wasm requires a cross-origin-isolated document, normally:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Every cross-origin basemap tile, sprite, font, image and scientific payload must then satisfy CORS/CORP requirements. Prefer self-controlled assets or verified providers. Because this can break map assets and third-party integrations, single-threaded Wasm remains the baseline and header enablement is a dedicated deployment gate.

## 6. Basemap and attribution

Do not ship production traffic against the public OpenStreetMap demo tile endpoint used by the current Leaflet component. Select or self-host a production-suitable vector basemap/style whose usage, rate, CORS/CORP and attribution terms work with the chosen traffic and cross-origin-isolation policy. Preserve attribution visibly in globe and mini-map views.

## 7. Geographic privacy

Exact observer positions may be sensitive. The browser can fetch region-specific scientific chunks without sending position to an application server beyond normal asset URLs, but CDN logs may still reveal coarse regions. Document retention, avoid analytics properties containing exact coordinates, and obtain consent before saving or sharing a location.

## 8. Preview deployments and compatibility

Each preview deployment should run automated checks for:

- direct `/globe` and `/observe` navigation and share links;
- Wasm fetch/compile and module worker creation;
- WebGL2 feature negotiation;
- emission/atmosphere/display tile range and cache behavior;
- headers, CORS/CORP and cross-origin isolation;
- route chunk isolation and asset sizes;
- production basemap attribution;
- stale-cache/release-manifest compatibility.

Preview deployments should use small conformance data, not duplicate full production releases.

## 9. Rollback and release identity

Application, `EmissionRelease`, `AtmosphereFieldRelease` and Physics releases deploy independently. A Viewer release declares the unified handshake ranges for `viewer_contract_revision`, `observer_scenario_schema_revision`, `environment_manifest_schema_revision`, `emission_schema_revision`, `atmosphere_schema_revision`, `environment_display_schema_revision`, `physics_abi_revision`, `observer_render_product_schema_revision` and `layer_manifest_schema_revision`. Rollback changes the application deployment without rewriting immutable data. Default domain channels can move only after compatibility and conformance tests pass; rolling back an atmosphere forecast channel does not roll back emission.

## 10. Deployment decision gates

1. Next.js proof builds worker, Wasm and two client-only viewer route chunks correctly.
2. Vercel preview serves correct MIME/cache/range behavior.
3. Cross-origin-isolated and non-isolated profiles both work with selected basemap/assets.
4. Large assets bypass Functions and app bundle.
5. Cold/warm performance meets budgets on at least one non-developer device class.
6. Exact coordinates are absent from default analytics/telemetry.

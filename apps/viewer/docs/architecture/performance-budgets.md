# Performance and resource budgets

## 1. Status

These are initial product budgets, not claims about current performance. They must be tested on representative hardware and revised from evidence. Scientific accuracy gates remain separate: meeting a frame budget does not prove that the sky solution converged.

## 2. Target device classes

Measure at least:

- high-end Apple Silicon laptop/desktop;
- mid-range current Windows laptop with integrated GPU;
- recent iPhone and mid-range Android phone;
- constrained/older WebGL2 laptop;
- Safari, Chromium and Firefox where supported.

Record exact browser, GPU, DPR, memory signals, power state and capability profile. Do not tune only on the developer Mac.

## 3. Experience budgets

Initial hypotheses for broadband cold loads on a mid-range laptop:

| Milestone | Target | Hard warning |
| --- | ---: | ---: |
| application shell usable | ≤ 1.5 s | 2.5 s |
| globe first coherent scientific layer | ≤ 2.5 s | 5 s |
| globe interaction after first layer | no >100 ms task | repeated >100 ms tasks |
| observer route controls usable | ≤ 1.5 s after navigation | 3 s |
| observer first coherent coarse sky | ≤ 5 s cold, ≤ 3 s warm | 10 s |
| committed location change acknowledgement | ≤ 100 ms | 250 ms |
| cancellation observed by scheduler | ≤ 100 ms | 500 ms |

Slow scientific refinement is acceptable if it is measurable, cancellable, and the coherent coarse result is useful. Never manufacture an unphysical placeholder sky to meet a timing budget.

## 4. Frame budgets

| Interaction | Preferred | Fallback |
| --- | --- | --- |
| desktop camera/globe movement | 60 fps; p95 frame ≤ 16.7 ms | 30 fps; p95 ≤ 33 ms |
| mobile camera/globe movement | stable 30–60 fps by tier | named constrained tier |
| static observer | render on demand | ≤ 10 fps only if refinement needs it |
| observer mini-map | render on demand | capped ≤ 15 fps during motion |

Main-thread JavaScript work should normally remain below 8 ms in an interactive frame. Upload work is chunked and scheduled; one complete atomic product does not require one monolithic upload if a staging generation can remain invisible until complete.

## 5. Bundle and network budgets

Set hard budgets after feasibility builds, but enforce these architectural constraints immediately:

- globe and observer are separate route chunks;
- MapLibre is not part of the observer core bundle (mini-map loads independently);
- Three.js and observer shaders are not part of the globe entry bundle;
- Physics Wasm, catalogues, LUTs and Environment emission/atmosphere chunks load on intent, not in the application shell;
- scientific assets are content-addressed and compressed appropriately;
- manifests are small and cache-refreshable; payloads are immutable and long-lived;
- no global Environment release is shipped as JSON or converted to millions of JS objects;
- atmospheric volume payloads are spatially, vertically, temporally and variable-subsetted before browser delivery.

First experiments must report compressed/uncompressed JS, Wasm compile size, startup memory, and data fetched for first coherent output.

## 6. Memory budgets

Initial peak targets:

| Tier | Total estimated app memory | Viewer GPU allocation target |
| --- | ---: | ---: |
| constrained/mobile | ≤ 256 MiB | ≤ 96 MiB |
| standard laptop | ≤ 512 MiB | ≤ 192 MiB |
| high fidelity | capability-gated, measured | explicit user-visible increase |

Browser memory reporting is incomplete, so track owned bytes deterministically in addition to available runtime metrics. Categories include Wasm memory, JS/typed arrays, decoded emission chunks, decoded atmosphere volumes, catalogue caches, Physics scratch/LUTs, textures, render targets, geometry, basemap tiles, and transition assets. The atmosphere cache has a separate budget and eviction key because vertical fields can dominate memory even when their globe display tile is small.

On route change, previous full-view allocations should fall close to the shared-shell baseline after disposal and GC opportunities. A repeating globe ↔ observer test must detect monotonically growing owned bytes or WebGL contexts.

## 7. Quality budgets

Quality is constrained by error rather than a single resolution number:

- emission aggregation/conservation error;
- atmospheric horizontal/vertical/time interpolation and state-reconstruction error;
- radiative-transfer angular/spatial/spectral residual;
- horizon gradient reconstruction error;
- PSF truncation/normalization error;
- star flux error through LOD/FOV/DPR changes;
- tone-map/display reference error;
- tile and LOD seam limits.

Physics owns physical tolerances; Viewer owns reconstruction/upload/display tolerances. Each quality profile publishes both its resource budget and expected error/approximation status.

## 8. Adaptive degradation order

Within a named profile, prefer:

1. stop background prefetch/refinement;
2. reduce DPR while retaining physical grid quality;
3. reduce nonessential labels and basemap detail;
4. reduce catalogue magnitude/LOD under flux-preserving policy;
5. reduce observer angular resolution according to Physics' supported tier;
6. reduce spectral/PSF fidelity only through an explicitly validated profile;
7. refuse the unsupported mode with explanation rather than silently producing false output.

Do not first reduce the very horizon/bright-source resolution whose blockiness motivated the rebuild.

## 9. Performance gates

Every milestone produces:

- device/browser matrix results;
- cold/warm network traces;
- bundle/asset inventory;
- p50/p95 frame and long-task distribution;
- owned CPU/GPU memory table;
- compute stage/cancellation timing;
- selected capability/quality profile;
- scientific error metrics for the same run.

No optimization is accepted only because it looks smoother on the primary Mac.

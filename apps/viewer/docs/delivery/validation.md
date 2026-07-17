# Viewer validation plan

## 1. Separation of evidence

Validation reports distinguish:

1. **Scientific correctness:** owned by Environment emission/atmosphere and Physics reference/convergence tests.
2. **Contract correctness:** units, coordinates, revisions, decoding and buffer layout.
3. **Rendering correctness:** projection, radiometric preservation, PSF use and display transform.
4. **Product correctness:** navigation, interaction, accessibility and provenance.
5. **Operational correctness:** performance, memory, compatibility and Vercel delivery.

A beautiful screenshot proves none of the first three by itself.

## 2. Test layers

### Unit and schema

- URL encode/decode and normalized coordinate/time values;
- state machine and preview/commit behavior;
- capability handshake and revision compatibility;
- binary descriptor parsing, stride/offset and invalid-buffer rejection;
- palette/normalization plus independent `DataValidity`, domain status and `RuntimeAvailability` logic;
- resource byte accounting and eviction.

### Contract conformance

- consume independent emission- and atmosphere-owned conformance fixtures;
- consume Physics render-product fixtures;
- verify WGS84/ENU/projection and antimeridian/pole cases;
- reject double temporal correction, incompatible releases and missing units;
- preserve exact scenario revision through worker/product/barrier path.
- preserve atmospheric evidence, run/valid/lead/member or climatology sample, vertical support and uncertainty through query, URL and observer scenario.

### Numeric rendering

- render tiny known float textures and sample output before/after display transform;
- verify integrated star flux across FOV, DPR and LOD;
- validate solid-angle interpolation and tile border behavior;
- verify normalized PSF energy and truncation accounting;
- ensure globe aggregation/picking matches authoritative values;
- isolate every composition pass for reference comparison.

### Visual regression

Use fixed capabilities, DPR, fonts, seeds, scenarios and output transforms. Cover:

- global/regional/local globe views including antimeridian and poles;
- atmospheric surface, column and altitude-slice layers with exact selection-mode and forecast/reanalysis/climatology/standard-scenario labels;
- physical zero, emission dark/upper-bound, missing/masked/censored/not-covered, loading and failed states plus palette legends;
- day/twilight/night observer cases;
- horizon, strong source, moonlit, cloudy and clear scenarios;
- narrow/wide FOV and high-DPR limits;
- route transitions, updating/stale/error states;
- responsive desktop/tablet/phone and reduced-motion modes.

Image thresholds must be paired with numeric probes so a broad tolerance cannot hide energy/colour errors.

### End-to-end

- open a direct globe URL, query value, place pin, enter sky;
- verify location/time/independent releases/evidence/run-or-sample survive transition;
- move mini-map rapidly and confirm only the final scenario appears;
- use back/forward/reload/share links;
- switch display-only settings without Physics recomputation;
- change physical inputs and observe a new revision/progress;
- simulate worker failure, missing tile and context loss;
- use keyboard-only and screen-reader flows.

### Performance and leak

- cold/warm traces on target device matrix;
- 20+ globe ↔ observer cycles with owned-byte/context/listener accounting;
- rapid cancellation stress and slow-network asset delivery;
- catalogue/tile cache pressure and eviction;
- background tab, device rotation, resize and power throttling;
- cross-origin-isolated threaded tier versus single-worker baseline.

## 3. Browser matrix

At minimum test supported current stable versions of:

- Safari on macOS and iOS;
- Chromium on macOS/Windows/Android;
- Firefox on macOS/Windows where WebGL/Wasm paths are supported.

Record WebGL renderer/capability data without using it as a fingerprinting product feature. Browser support statements are tied to test date and release.

## 4. Release gates

A Viewer release cannot become default until:

1. contract fixtures pass for its declared emission/atmosphere/Physics version ranges;
2. no known stale-revision mixing exists;
3. globe and observer numeric rendering probes pass;
4. main journeys and direct route loads pass on the browser matrix;
5. resource lifecycle has no monotonic leak in route-cycle tests;
6. performance budgets are reported on non-developer hardware;
7. Vercel headers, caching, MIME, range, CORS and attribution pass;
8. accessibility review covers both canvas and non-canvas access;
9. every degradation is named and scientifically disclosed.

## 5. Evidence artifacts

Each milestone stores:

- exact app/emission/atmosphere/Physics/data revisions and source run/sample identities;
- scenario descriptors and capability profiles;
- commands and environment;
- numeric metrics, traces and memory inventory;
- reference/output images;
- pass/fail interpretation and known limitations.

Implementation without this run evidence does not count as a completed milestone.

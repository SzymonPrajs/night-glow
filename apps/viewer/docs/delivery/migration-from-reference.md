# Migration from the current application

## 1. Migration stance

The current React/Vite application is a behavioral reference and experiment harness. It is not the component architecture to extend. Build the new Viewer alongside it and retire old paths only after parity or an explicit product decision.

## 2. Current baseline observed

The current project already has useful foundations:

- React 18 + Vite + TypeScript application;
- Three.js `WebGLRenderer` with a high-performance preference, shaders, batched point geometry and device-pixel cap;
- WebGL-rendered sky, stars, Milky Way, bodies and physical-glow mesh;
- a module worker for physical glow, cancellation, progress and transferable typed buffers;
- Astronomy Engine and local astronomy/appearance/photometry code;
- Leaflet location picker with heading and observer pin;
- atmosphere, seeing/PSF, display enhancement and physical-analysis controls;
- numeric appearance/celestial/seeing/calibration/physics/weather checks and Playwright tests.

The main architectural liabilities are also clear:

- `App.tsx` directly coordinates UI, astronomy, physical metrics, worker results and renderer props;
- `SkyCanvas.tsx` is roughly 1,500 lines and owns scene lifecycle, input, shader setup, star/Milky Way/body/glow construction, appearance and labels;
- Physics still exists across TypeScript libraries, hooks and UI-facing concepts;
- Leaflet and the sky are composed as a drawer plus canvas, not two first-class views;
- current source, eight weather presets and sky models are useful fixtures but are not the proposed Environment/Physics package boundaries.

## 3. Preserve as fixtures

Preserve behavior and tests where scientifically or ergonomically useful:

- exact location/time changes and timezone display;
- drag/pinch/wheel/keyboard camera behavior and reset;
- worker cancellation and “show last valid while updating” state;
- transferable buffer protocol patterns;
- star/PSF/calibration/physical-model reference cases;
- atmosphere/weather presets as explicitly labelled parity/`standard_scenario` fixtures, not production evidence;
- current rendered screenshots as explicitly labelled visual baselines;
- resource disposal and resize behavior where tests confirm it.

Preservation does not mean copying implementation. New Rust Physics must reproduce accepted numeric fixtures before extension; the new renderer must reproduce accepted display fixtures through its own product contracts.

## 4. Do not port wholesale

- the current `App.tsx` state/prop graph;
- physical analysis panels as primary navigation;
- individual physical settings that lack reviewed scenario semantics;
- the monolithic `SkyCanvas` component;
- direct imports of astronomy/physics functions into UI components;
- Leaflet or the public OSM demo tile endpoint;
- appearance hacks that duplicate physical radiance or PSF;
- assumptions that canvas DPR equals physical resolution.

## 5. Strangler migration

### Phase A — characterize

- freeze representative scenario fixtures and screenshots;
- instrument current worker, render frame, buffer sizes and route-like mode changes;
- catalogue every current control as physical, display-only, diagnostic, or obsolete;
- document which tests are trusted and which merely encode a placeholder model.

### Phase B — prove the new boundaries

- prototype MapLibre globe custom layers with synthetic emission and atmospheric surface/column/slice display tiles;
- prototype ObserverEngine around a tiny Physics-like render descriptor;
- prove worker/Wasm buffer transfer and scenario revision cancellation;
- prove Next.js/Vercel route chunking, WebGL cleanup and deployment headers.

No full UI rewrite proceeds if any boundary proof fails without a reviewed alternative.

### Phase C — new shell alongside old app

- create the Next.js Viewer package/workspace after stack review;
- add `/globe` and `/observe` behind a development entry or feature flag;
- use fixture adapters before production Environment/Physics packages exist;
- create accessible shell, URL state and transition lifecycle;
- keep the Vite app runnable for comparison.

### Phase D — extract and replace render behavior

- turn accepted sky behaviors into ObserverEngine passes and tests;
- replace TypeScript calculations product family by product family with Physics Wasm outputs;
- replace regional/ellipsoid source input with emission-provider fixtures/releases and replace UI weather presets with atmosphere-provider fixtures/releases;
- add coherent coarse/refined barriers and capability tiers;
- remove duplicated TypeScript/GLSL physics only after parity.

### Phase E — production data and retirement

- connect immutable emission/atmosphere/display and Physics data manifests;
- validate non-developer devices and Vercel production-like assets;
- run old/new numeric and visual comparison suites;
- migrate default entry only after acceptance gates;
- retain a bounded archive/reference route only if it still serves validation.

## 6. Framework migration gate

Next.js is the planned target, but the framework move is not the first risky step. Prove three integration questions first in a disposable branch/package:

1. MapLibre globe custom layer and mini-map lifecycle.
2. Three.js observer route lifecycle with zero lingering render loops/contexts.
3. Rust/Wasm worker bundling, asset URLs, cancellation and Vercel headers.

If Next introduces a measured blocker not present in Vite, document it and reassess. Do not rewrite working scientific code merely to satisfy a framework convention.

## 7. Parity matrix

Track each current capability as:

| Capability | Fixture trusted? | New owner | Parity method | Retirement gate |
| --- | --- | --- | --- | --- |
| location selection | yes, interaction | Viewer | E2E coordinate round trip | globe + mini-map pass |
| astronomy positions | conditional | Physics astronomy | numeric ephemeris cases | reviewed tolerance |
| physical glow field | placeholder/conditional | Physics + Environment | reference/convergence tests | new model accepted |
| eight weather presets | fixture only | Environment state + Physics optics | profile/column/volume and radiance cases | `standard_scenario` semantics accepted |
| star appearance/PSF | initial fixture | Physics + Observer renderer | flux/PSF numeric and images | parity then richer model |
| sky enhancement | classify first | Viewer display transform | HDR reference transform | no hidden physics |
| progress/cancellation | yes, pattern | Viewer runtime + Physics | rapid-change stress test | no stale mixing |

The full matrix is a roadmap deliverable before deleting any current module.

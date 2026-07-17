# Unified two-view user experience

## 1. Product model

Night Glow is one spatial investigation tool with two scales, not two unrelated demos. The globe answers **where is the source or environmental condition?** The observer answers **what does the sky look like here when those conditions and sources are physically propagated?** Location, requested time, independent emission/atmosphere releases, `AtmosphereSelectionMode`, and provenance carry across the transition.

The primary navigation language is:

- **Globe** — explore global layers.
- **Sky at pin** — experience the observer solution.

Avoid exposing implementation terms such as Wasm, kernel rows, H3 cells, shader passes, or FFT settings in the default interface. They belong in an optional scientific inspector.

## 2. UI leaf pass: start from the product, not the current panels

The existing interface is a useful behavior inventory, but its drawer hierarchy is not the new information architecture. The new interface starts with four questions:

1. Where and when are we observing?
2. Which measured/modelled layer is active?
3. What result is current, updating, approximate, or unavailable?
4. How can the user inspect provenance and change the scenario without covering the visual field?

### Shared shell

A restrained floating shell appears above either canvas:

- product identity and Globe/Sky mode switch;
- location search and coordinate entry;
- time control with explicit UTC/local display;
- active layer/scenario control;
- share button plus separate runtime status and scientific fidelity/validity indicator;
- a single expandable details surface for layers, atmosphere, provenance, and diagnostics.

The shell must not force desktop side drawers. On wide screens, controls can become compact side sheets; on phones and tablets they become bottom sheets. Canvas space and direct manipulation remain primary.

## 3. Globe journey

1. The user arrives on the globe with a declared Environment Atlas domain release, time/evidence selection, palette, and legend.
2. Zooming changes spatial detail without changing the represented unit or silently renormalizing the data.
3. Hover/tap identifies a coordinate and value. Missing, dark, masked, and unknown remain visibly distinct.
4. Clicking places a preview pin and opens a compact place card.
5. **Enter sky here** begins preloading the observer route, Physics Wasm, relevant emission and atmospheric chunks, catalogue tiles, and renderer bundle.
6. The camera moves toward the location while the route changes. A progress surface reports real stages rather than an indefinite spinner.
7. The first coherent observer result replaces the transition image; later refinements arrive atomically.

The user may also save/copy coordinates or inspect the source cell without entering the sky.

## 4. Observer journey

The observer opens at the committed pin and time. Dragging looks around; wheel/pinch changes field of view. The sky is usable while higher-fidelity work refines, but every visible layer comes from one coherent scenario revision.

A collapsible mini-map shows:

- committed observer pin;
- preview pin while navigating;
- viewing azimuth and approximate field of view;
- optional source-domain/quality footprint in diagnostic mode.

Dragging the preview pin must not launch a full solution for every pointer event. On release—or after a deliberate confirmation/debounce—the preview becomes committed. The old coherent sky remains visible with an **Updating from previous location** label until a complete coarse solution is ready.

The user can return to the globe without losing its camera or layer selection. The full globe engine may be reconstructed from a small saved snapshot; it does not need to stay rendered off-screen.

## 5. Information hierarchy

### Always visible

- current mode;
- place/coordinates;
- observation time and timezone basis;
- active layer or sky scenario;
- concise state: current, updating, approximate, offline, or failed.

### One action away

- map legend and units;
- atmosphere selection mode, source run/lead/member or climatology/standard-scenario identity—not an unexplained weather preset;
- selected emission, atmosphere and Physics versions;
- source/profile uncertainty;
- exposure and display-only controls;
- requested fidelity/performance mode.

### Scientific inspector

- exact model/data manifests;
- per-product LOD, residual, mask, and uncertainty;
- compute stages and timing;
- spectral basis and render-target diagnostics;
- source cells and propagation domain;
- downloadable scenario/result metadata.

The inspector is essential for review but is not the default product surface.

## 6. Display controls versus physical controls

The UI must visually and semantically distinguish:

| Display-only | Recomputes science |
| --- | --- |
| exposure, tone map, palette, label density, UI brightness | time, observer position/height, atmosphere release/evidence/run/sample, source release/profile, spectral observer |

A display control updates immediately from retained HDR state. A physical control creates a new scenario revision and exposes progress. A physical control must never be implemented as a shader tint simply to feel responsive.

## 7. Pollution layer model

The globe is designed for more than light. The layer panel should support independent plugins with:

- identity, title, description, provenance and licence;
- physical quantity, unit, valid time and uncertainty;
- surface scalar, vector, column, volume, station, or event representation;
- tile/source descriptor and supported projections/zoom range;
- palette, normalization policy, legend and query formatter;
- aggregation semantics and missing-data states.

Light emission is the first `surface-scalar-directional-intensity` layer. Atmospheric pollution supports surface, column, altitude-slice/profile and uncertainty layers with independent time/evidence semantics. It must not be forced into `J_DNB`, H3, or the emission time model. A later correlation view can combine layers only after unit, support, resolution and valid-time alignment are explicit.

## 8. Responsive behavior

- Desktop: floating toolbar; optional narrow details sheet; mini-map can stay open.
- Tablet: toolbar collapses; details and mini-map use movable bottom sheets.
- Phone: canvas remains full-screen; a thumb-reachable mode/location/time strip; one sheet open at once.
- Touch and keyboard interactions receive first-class designs, not mouse emulation.
- Safe-area insets, browser chrome changes, and dynamic viewport units are tested.

## 9. Accessibility

Canvas output cannot be the only interface to data.

- Every map point can be entered by search or coordinates.
- Queried layer values and sky status appear as text.
- Keyboard controls support pan/rotate/zoom, pin placement, and view reset.
- Focus remains stable across route transitions and sheet changes.
- Status updates use a throttled live region and never announce every compute percentage.
- Palettes have colour-vision-safe options and do not encode missingness only by hue.
- Reduced-motion mode removes cinematic globe-to-sky movement.
- High-contrast controls and minimum touch targets are required.

## 10. Trust and provenance

Every displayed result can answer:

- What quantity is this?
- Is it measured, reconstructed, propagated, interpolated, or display-mapped?
- Which emission, atmosphere, Physics and catalogue releases/runs/samples produced it?
- What time and coordinate frame apply?
- What is missing, approximate or outside validity?

The transition from globe brightness to observer sky must make the change in meaning explicit: **surface emission source** becomes **propagated observer radiance** after Physics, not merely the same colour wrapped around a sky dome.

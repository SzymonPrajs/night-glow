# ADR 0001: Separate surface emission from atmospheric propagation

- Status: accepted
- Date: 2026-07-17

## Context

The source evidence changes annually and by locality. Atmosphere, weather, observer, wavelength, and requested sky direction change per query. A pre-propagated global raster would couple all of these and prevent proper 3-D recomputation.

## Decision

The emission domain produces a surface emission release only. The Environment Atlas workspace may separately publish atmospheric-state releases, but it never propagates emission to an observer. The main physical solver consumes the independently versioned products and performs curved-Earth atmospheric transport. An `EmissionRelease` contains no fixed propagation radius, aerosol, or observer result.

## Consequences

- Source and propagation errors can be validated separately.
- One emission release supports multiple atmospheric releases/scenarios and a future globe mode.
- The handoff must retain physical units, spectrum/angle/time profiles, elevation, and uncertainty.
- The future app needs two clearly labelled layers: surface emission and modelled skyglow.
- The one-way, versioned emission boundary is specified in [the Physics handoff contract](../18-physics-handoff.md); the atmosphere-state boundary is [documented separately](../21-atmosphere-physics-handoff.md), and Environment Atlas never imports Physics.
- The initial surface signal is already outgoing and is not passed through the ground BRDF a second time by Physics.

# ADR 0001: Separate surface emission from atmospheric propagation

- Status: accepted
- Date: 2026-07-17

## Context

The source evidence changes annually and by locality. Atmosphere, weather, observer, wavelength, and requested sky direction change per query. A pre-propagated global raster would couple all of these and prevent proper 3-D recomputation.

## Decision

The side project produces a surface emission atlas only. The main physical solver consumes it and performs curved-Earth atmospheric transport. The atlas contains no fixed propagation radius, aerosol, or observer result.

## Consequences

- Source and propagation errors can be validated separately.
- One atlas supports multiple atmospheric scenarios and a future globe mode.
- The handoff must retain physical units, spectrum/angle/time profiles, elevation, and uncertainty.
- The future app needs two clearly labelled layers: surface emission and modelled skyglow.

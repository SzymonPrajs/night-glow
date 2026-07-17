# ADR 0002: Conserve directional DNB intensity during refinement

- Status: accepted for feasibility testing
- Date: 2026-07-17

## Context

VIIRS measures broad-band radiance in a satellite viewing direction. It does not measure total hemispheric upward power. Multiplying radiance by π assumes Lambertian emission, which is unsupported globally and particularly weak for shielded or near-horizontal lighting.

## Decision

Convert surface radiance to SI and integrate it over exact source support to obtain `J_DNB [W sr^-1]`. Spatial disaggregation conserves `J_DNB`. Total upward flux is inferred only through a named angular emission profile with uncertainty.

## Consequences

- OSM/WSF refinement cannot invent additional brightness.
- The baseline remains close to an observed physical quantity.
- The propagation interface needs the reference view convention and angular profile.
- Feasibility work must confirm Black Marble's exact corrected-radiance convention.
- The consumer contract carries `J_DNB`, its DNB response ID, corrected reference view, and tagged profile states without promoting it to total flux or Physics' runtime spectral basis.

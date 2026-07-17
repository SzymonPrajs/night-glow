# `nightglow-core`

Shared language for all calculations. This crate should be small, stable, and free of domain algorithms.

## Proposed modules

- `units`: newtypes for length, angle, time, temperature, pressure, number density, optical depth, wavelength, spectral radiance, radiant intensity, flux, irradiance, and dimensionless probabilities.
- `spectrum`: wavelength grids, band response functions, basis transforms, integration conventions, and metadata.
- `coordinates`: geodetic/ECEF vectors, inertial/apparent directions, local ENU/horizon coordinates, and frame-tagged transforms.
- `grids`: regular/adaptive angular grids, HEALPix cell IDs, geospatial tile IDs, tensors, strides, and owned/borrowed views.
- `quality`: uncertainty, missing-data masks, convergence residuals, fidelity level, and evidence flags.
- `identity`: scenario revisions, model revisions, dataset revisions, content hashes, and cache keys.
- `time`: typed instants only; conversion algorithms belong to astronomy.
- `error`: structured domain, data, numerical, cancellation, compatibility, and resource errors.

## Invariants

- Public boundaries never use unlabelled numbers when units or frames can be confused.
- Spectral quantities say whether they are per wavelength, per frequency, or band-integrated.
- Directions say which frame and epoch they inhabit.
- Missing or extrapolated data remains distinguishable from a physical zero.
- Array layout is declared and versioned; Wasm views and WebGL upload code do not guess strides.
- Serialization includes schema/model revision and rejects incompatible major revisions.

## Deliberate exclusions

No files, HTTP, browser types, random global state, scattering equations, catalogue policy, scheduling, or tone mapping.

# `nightglow-core`

Shared language for all calculations. This crate should be small, stable, and free of domain algorithms.

The first implementation contains validated immutable IDs and UTC instants,
closed validity/uncertainty states, stable error categories, the scalar quantity newtypes used by the M1
reference proof plus the frozen `ObserverScenario`, `PhysicsDataManifest`,
`SurfaceTerrainProduct`, Environment-input, boundary-source, optical-state, and
coherent render-product types needed by the synthetic vertical slice. Physical
integration and response construction live in `nightglow-physics`.

## Proposed modules

- `units`: newtypes for length, angle, time, temperature, pressure, number density, optical depth, wavelength, spectral radiance, radiant intensity, flux, irradiance, and dimensionless probabilities.
- `spectrum`: wavelength grids, band response functions, basis transforms, integration conventions, and metadata.
- `coordinates`: geodetic/ECEF vectors, inertial/apparent directions, local ENU/horizon coordinates, and frame-tagged transforms.
- `grids`: regular/adaptive angular grids, HEALPix cell IDs, geospatial tile IDs, tensors, strides, and owned/borrowed views.
- `validity`: shared `DataValidity` only; domain status remains domain-owned.
- `evidence`: typed source evidence references without domain inference policy.
- `uncertainty`: typed intervals/quantiles/covariance references.
- `numerics`: convergence residuals and fidelity/approximation identity, separate from input uncertainty.
- `identity`: scenario revisions, model revisions, dataset revisions, content hashes, and cache keys.
- `time`: typed instants only; conversion algorithms belong to astronomy.
- `error`: structured domain, data, numerical, cancellation, compatibility, and resource errors.

Environment-domain-specific fields do not move into `nightglow-core`. Shared meanings such as SI radiometric units, WGS84 geodetic coordinates, source-local ENU directions, vacuum-nanometre wavelengths, `DataValidity`, and revision identities are represented compatibly, while emission/atmosphere schemas remain independently owned and versioned by Environment. The [unified system contract](../../../contracts/README.md) is the cross-project vocabulary authority.

## Invariants

- Public boundaries never use unlabelled numbers when units or frames can be confused.
- Spectral quantities say whether they are per wavelength, per frequency, or band-integrated.
- Directions say which frame and epoch they inhabit.
- Missing or extrapolated data remains distinguishable from a physical zero.
- Array layout is declared and versioned; Wasm views and WebGL upload code do not guess strides.
- Serialization includes schema/model revision and rejects incompatible major revisions.

## Deliberate exclusions

No files, HTTP, browser types, random global state, scattering equations, catalogue policy, scheduling, or tone mapping.

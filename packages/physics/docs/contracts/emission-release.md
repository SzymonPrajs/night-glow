# Environment emission domain consumer contract

Physics consumes Environment emission domain as an independent, versioned source product. It does not merge Environment workspace, repeat satellite/source inference, or require Environment to emit Physics' internal spectral grid. Environment owns the normative producer semantics; this document owns the Physics adapter and consumer obligations.

The sibling Environment design describes its producer contract in [Environment emission domain: Physics handoff contract](../../../environment/docs/emission/physics-handoff.md). If the projects are developed in separate repositories, the Physics dependency pins an Environment schema/release version and carries the corresponding conformance fixture rather than relying on a relative source-tree link.

## 1. Shared language

| Environment term | Physics meaning |
| --- | --- |
| `EmissionRelease` | Immutable upstream data product registered as an asset dependency |
| `SurfaceEmissionCell` | One exact-support source record; H3 selects it but does not define physical geometry |
| `J_DNB [W sr^-1]` | Conserved DNB-response directional intensity over the cell support for a declared corrected reference view |
| `SpectralProfile` | Optional source spectral shape/support; requires projection into the Physics basis |
| `AngularEmissionProfile` | Optional upward directional model with explicit normalization |
| `TemporalProfile` | Optional factor normalized to 1 at Environment reference phase |
| `EmissionModelFamily` | Compatibility constraint tying spectrum, angle, and source class |
| `CoverageStatus` | Supported emission, supported dark/upper-bound, or no evidence; never flattened to one scalar |
| `EmissionTimeContext` | Explicit time/civil/solar fields supplied to profile evaluation |
| `EmissionFieldProvider` | Physics-side streaming adapter over one emission release and its chunks |
| `ArtificialLightBoundarySource` | Physics-internal wavelength/direction/time-resolved outgoing source |

`J_DNB` is not total upward flux, photopic power, an eight-band spectrum, or sky radiance at the observer.

## 2. Ownership boundary

Environment emission domain owns raw nighttime radiometry, atmospheric/view correction of the satellite observation, exact support integration, conservative H3 refinement, source-evidence fusion, source profiles and their evidence, source-side uncertainty, release format, provenance, licence partitions, and chunk intensity bounds.

Physics owns compatibility checks, source scenario policy, time/astronomy context, projection into the selected wavelength basis, construction of outgoing boundary sources, exact Earth/terrain propagation geometry, atmosphere/cloud/aerosol transport, subsequent surface reflections, adaptive tail termination, observer radiance, PSF, and rendering outputs.

The dependency is one-way:

```text
EmissionRelease -> nightglow-data::emission_adapter
             -> nightglow-physics::artificial-light
             -> nightglow-solver
```

Physics may depend on released Environment schema/format crates or an independent conforming decoder. Environment emission domain never depends on Physics crates.

## 3. Adapter input

The adapter consumes release/dictionary/chunk descriptors containing:

- Environment schema/model/release identities and content hashes;
- H3 cell plus exact support/area semantics;
- WGS84 location and declared vertical datum/source-height support;
- `J_DNB`, uncertainty, DNB response ID, and corrected reference view;
- tagged resolved/unresolved spectrum, angle, and time profile references;
- joint emission-model-family identity;
- coverage, censoring, evidence, quality, posterior method, and uncertainty components;
- provenance/licence handles and attribution;
- chunk intensity/uncertainty bounds.

The adapter rejects unknown mandatory semantics, unsupported major `emission_schema_revision` values, invalid hierarchy/profile references, non-finite/impossible quantities, missing dictionaries, and incompatible source profiles. It preserves missing/no-evidence separately from physical zero.

## 4. Coordinate contract

Geography is WGS84 geodetic, north-positive latitude and east-positive longitude. Physical area/path/terrain calculations use exact declared support and validated ellipsoidal geometry; H3 average centres/areas are never substituted.

Directions use a source-local right-handed east–north–up frame. Outgoing emission zenith angle is 0 at local up and 90 degrees at the horizon. Absolute azimuth is 0 at true geodetic north and increases eastward. Feature-relative angular harmonics carry a separate declared orientation.

Height/elevation states declare datum and distinguish surface elevation, source height above surface, and ellipsoidal height. Physics combines Environment source-height evidence with its terrain data exactly once.

## 5. Conversion into a Physics source

For each selected cell, Physics performs this ordered conversion:

1. Validate emission release/schema/dictionaries and select baseline/enrichment replacement according to emission-domain hierarchy rules.
2. Preserve `J_DNB` and its corrected-reference-view meaning unchanged.
3. Evaluate a resolved temporal profile with an explicit `EmissionTimeContext`; otherwise retain factor 1 plus unresolved status unless a named scenario is selected.
4. Select only mutually compatible spectral/angular profiles from the same allowed `EmissionModelFamily`.
5. Verify or trust a conformance-tested forward closure: the chosen profiles integrated through the stored DNB response at the stored reference view reproduce time-adjusted `J_DNB` within uncertainty.
6. Project the resolved spectrum from vacuum-nanometre Environment support into the chosen Physics wavelength basis using a versioned operator and measured projection error.
7. Evaluate the outgoing angular model in source-local ENU and construct `ArtificialLightBoundarySource` over the cell's exact horizontal/vertical support.
8. Carry uncertainty/evidence/provenance and active scenario IDs into diagnostics, caches, and results.
9. Pass the boundary source to terrain/atmospheric propagation.

If spectrum or angle is unresolved, Physics does not have a unique spectral-directional source. Allowed outcomes are:

- `InsufficientSourceEvidence` for a central physical solve;
- a conservative bound if a validated bound exists;
- an explicitly selected scenario such as a named lamp mixture or Lambertian angular model, recorded in the scenario revision and result.

There is no silent “typical city”, Lambertian `pi * L`, current-eight-band, or constant-night default presented as measured physics.

## 6. Surface reflection rule

The Environment value is already an outgoing surface-side signal and may combine direct upward and first-reflected lamp light. Physics must not apply the ground BRDF to the initial Environment value again. If Environment explicitly separates direct and first-reflected components, Physics may consume them as separate outgoing components without recomputing their pre-release history.

Once this outgoing source enters the atmosphere, later atmosphere-to-ground-to-atmosphere bounces are new radiative-transfer orders owned by Physics. This distinction prevents both omission and double counting.

Likewise, Environment has already reconstructed a corrected source-side DNB signal from the satellite path. Physics propagates a new source-to-observer path and never reapplies or reverses the satellite correction.

## 7. Time context

Physics astronomy supplies UTC and solar/ephemeris fields. The application supplies authoritative IANA civil-zone/policy/holiday context. The adapter passes only explicit fields required by the profile:

```text
EmissionTimeContext {
  requested_time_utc
  civil_time? + iana_zone_id? + tzdb_revision?
  local_apparent_solar_time?
  sun_altitude? + hours_since_sunset? + hours_until_sunrise?
  weekday/holiday/event_class?
}
```

Physics does not make Environment astronomy-dependent, and Environment does not duplicate SOFA/JPL/time-scale logic. Missing profile inputs preserve the reference factor and mark unresolved; longitude is not a time zone.

## 8. Uncertainty and quality

The adapter preserves radiometric, sampling, spatial-allocation, spectral, angular, temporal, and model-discrepancy components. It also preserves evidence class, coverage state, censoring, and whether each profile is measured, operational, inferred, scenario, or unresolved.

The solver may run a central value, interval, sensitivity sweep, or ensemble. Any component it does not propagate is listed as omitted, not silently absorbed into numerical residual. Environment uncertainty, Physics model uncertainty, and numerical convergence residual remain separate fields.

## 9. Streaming, tail bounds, and Wasm

The `EmissionFieldProvider` exposes coarse, batch-oriented operations:

```text
open_emission_release(manifest, dictionaries) -> emission_release_handle
plan_emission_query(handle, region, time_context, source_policy) -> ChunkPlan
register_chunk(emission_release_handle, chunk_descriptor, bytes)
query_emission(handle, request) -> SurfaceEmissionBatch
```

The batch is contiguous, dictionary-referenced numeric storage rather than per-cell JavaScript objects. Preferred deployment is to decode/query emission chunks in the same coordinator worker as the Physics Wasm engine, using the emission decoder dependency or zero/one-copy buffer handoff. Separate independently versioned Wasm modules are also valid if they exchange coarse transferable/shared buffers.

Emission chunk bounds state source-side `J_DNB` limits. Physics combines them with wavelength/profile uncertainty and a conservative transfer bound to decide expansion/termination. Physics never treats a chunk bound as observer radiance and never imposes an emission-data cutoff such as 150 km.

## 10. Revisions and cache identity

Physics cache keys include:

- `emission_schema_revision`, `emission_model_revision`, `emission_release_id`;
- exact chunk and dictionary hashes;
- DNB response/reference-view identity;
- baseline/enrichment/layer selection policy;
- time context and temporal-profile result/status;
- spectral/angular scenario IDs and projection revision;
- source geometry/height resolution;
- Physics model and scenario revisions.

`EmissionRelease` changes invalidate source-derived Physics products without changing the Physics model revision. Physics math changes invalidate propagation products without requiring a new `EmissionRelease`. This is why the products/projects remain separately versioned.

## 11. Provenance and licences

Physics retains emission-domain provenance/attribution handles for every consumed chunk and exposes the active attribution bundle to the application. Physics precompute must not embed restricted or ODbL-derived emission products into a differently licensed artifact without the emission release partition and downstream legal review allowing it.

Physics-derived caches are not new emission releases. They record the upstream release and licence partition, are immutable/content-addressed, and cannot erase source lineage.

## 12. Boundary validation

Both projects use the same tiny open conformance fixture, owned and versioned by Environment emission domain. Physics tests:

- schema/native/Wasm decoding compatibility;
- exact preservation of `J_DNB` before propagation;
- profile DNB forward closure;
- resolved/unresolved/dark/no-evidence behavior;
- coordinate/height/direction conventions;
- mixed-resolution ancestor/descendant exclusion;
- temporal context and factor-1 reference normalization;
- uncertainty/evidence/provenance retention;
- no satellite-path correction replay;
- no initial surface-reflection double count;
- source-domain tail convergence using chunk bounds;
- deterministic cache invalidation across Environment/profile revisions.

End-to-end validation pins both `emission_release_id` and `physics_model_revision`. Residual reports separate Environment source reconstruction, profile/scenario uncertainty, atmosphere/terrain inputs, Physics model inadequacy, numerical error, and display differences.

## 13. What is intentionally not shared

- Rust workspaces and release cadence;
- raw-data ingestion and scientific source-fusion implementation;
- atmospheric solver internals and LUT formats;
- WebGL render products;
- task schedulers and caches;
- internal spectral grids, except through explicit projection;
- model revisions, except as dependency identities;
- deployment topology, beyond the versioned batch/format contract.

The shared surface is deliberately small: physical quantities, coordinates, profiles/status, uncertainty/provenance, immutable versions, chunk queries, and conformance fixtures.

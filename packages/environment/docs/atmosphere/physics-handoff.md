# 21. Atmospheric-state handoff to Physics

This document defines the producer meaning of `AtmosphereFieldRelease`. The independent consumer restatement is [`../../../physics/docs/contracts/environment.md`](../../../physics/docs/contracts/environment.md).

## 21.1 Dependency

```text
weather/composition sources
  -> Environment atmospheric ingest/fusion/climatology
  -> immutable AtmosphereFieldRelease
  -> Physics AtmosphereFieldProvider
  -> spectral optical state
  -> curved-Earth radiative transfer
```

Environment never imports Physics. Physics may use the released format crate/decoder or an independent decoder that passes the atmosphere-domain conformance fixture.

## 21.2 Canonical terms

| Term | Meaning | Owner |
| --- | --- | --- |
| `AtmosphereFieldRelease` | immutable manifests, dictionaries, runs and chunks for state fields | Environment atmosphere domain |
| `SourceRunIdentity` | `source_run_id` plus provider/system/version/cycle identity | Environment atmosphere domain |
| `SourceEvidenceClass` | per-variable/value lineage; it does not select the whole runtime atmosphere | Environment atmosphere domain |
| `AtmosphereSelectionMode` | runtime selection: observation-adjusted analysis, analysis, forecast, reanalysis, climatology sample, standard scenario or insufficient | Environment atmosphere domain |
| `AtmosphereStateVolume` | requested contiguous 4-D state arrays with coordinates, `DataValidity`, evidence and uncertainty | Environment atmosphere domain |
| `AtmosphereFieldProvider` | Physics-side streaming/query adapter | Physics |
| `OpticalAtmosphereState` | wavelength-dependent molecular/aerosol/cloud coefficients and phase representation | Physics |
| `ObserverRenderProductSet` | coherent observer-radiance/render product family for one scenario/tier | Physics |

## 21.3 Required variables and semantics

The release supplies typed variables only where evidence exists: pressure, temperature, humidity/water vapour, geopotential/height, wind, ozone, cloud fraction/condensate/hydrometeors, aerosol species/bin mass, PM diagnostics and provider optical diagnostics. Every variable specifies unit, wet/dry convention, native support, vertical coordinate, `DataValidity`, `SourceEvidenceClass`, uncertainty and transform/provenance. Runtime selection metadata is separate.

Unresolved/missing variables remain tagged. No consumer may treat missing aerosol as clean air or missing cloud as clear.

## 21.4 Coordinate contract

- WGS84 geodetic horizontal coordinates and exact source grid/support.
- Explicit pressure/hybrid/geopotential/geometric/terrain-relative vertical coordinates.
- Hybrid coefficients and surface pressure are supplied when needed to reconstruct levels.
- Longitudes, axis order, staggering, cell centres/bounds and terrain masks are declared.
- Time uses `requested_time_utc`, `analysis_time_utc`, `valid_time_utc`, `lead_duration`, `source_run_id` and `ensemble_member_id` with the meanings in the [unified system contract](../../../contracts/README.md).

Physics requests a geodesic region/altitude domain and may convert to its curved-Earth geometry. It cannot use tile centres or planar distance as propagation geometry.

## 21.5 State-to-optics rule

Physics owns final wavelength-dependent extinction, scattering, absorption, single-scattering albedo, phase functions and cloud optical closure. It records the optical model revision and whether it used:

1. source-provided optical diagnostics consistently;
2. reconstructed optics from species/microphysics/humidity;
3. an explicit named fallback scenario.

It must not double-apply hygroscopic growth if provider aerosol/optics are already wet at ambient RH. It must not treat PM2.5, AOD or visibility alone as complete optical state. If constraints are insufficient, Physics returns a bound/ensemble, named scenario or insufficient evidence.

## 21.6 Climatology and sampling

A climatology query returns a joint sample or distribution identity, not independent medians. `climatology_model_revision`, baseline period, conditioning and `climatology_sample_id`, quantiles and fallback level enter Physics cache/result provenance. Sampling the same ID is reproducible. Its `AtmosphereSelectionMode` is `climatology_sample`.

## 21.7 Query shape

```text
open_atmosphere_release(manifest, dictionaries) -> atmosphere_release_handle
resolve_atmosphere_selection(handle, requested_time_utc, policy)
    -> AtmosphereSelection
plan_atmosphere_query(handle, curved_earth_region, vertical_support,
                      variables, selection, lod) -> ChunkPlan
register_chunk(atmosphere_release_handle, chunk_descriptor, bytes)
query_atmosphere(handle, request) -> AtmosphereStateVolume
```

Buffers are contiguous and batch-oriented. Environment atmosphere decoding and Physics may share a coordinator worker without becoming one package. No per-voxel JavaScript object/call is allowed.

## 21.8 Versions and caches

Physics cache keys include `atmosphere_schema_revision`, `atmosphere_model_revision`, `atmosphere_release_id`, `source_run_id`, `analysis_time_utc`, `valid_time_utc`, `lead_duration`, ensemble or climatology/standard identity, `observation_correction_revision`, `climatology_model_revision`, exact chunks, interpolation/downscaling revisions, requested domain/variables and `atmosphere_optics_model_revision`. Atmosphere updates and Physics math updates invalidate independently.

## 21.9 Conformance fixture

The atmosphere domain will publish tiny open cases containing:

- one full meteorological/aerosol/cloud column on hybrid levels;
- a horizontally varying city-plume/rural synthetic field;
- paired species and source optical diagnostics with column closure;
- forecast members/lead metadata;
- climatology correlated samples;
- missing aerosol/cloud and explicit standard-scenario cases;
- antimeridian, high terrain and below-ground masks;
- corrupt/incompatible units, coordinates and revisions.

Atmosphere-domain tests prove decode, coordinates, conservation, closure and native/Wasm parity. Physics tests prove correct state-to-optics policy, no humidity double count, no scalar substitution, spatially varying propagation and retained uncertainty/provenance.

## 21.10 Responsibility matrix

| Concern | Environment | Physics |
| --- | --- | --- |
| Provider ingest/licence/run/QA | owns | never repeats |
| 4-D state fusion and climatology | owns | consumes |
| Spatial/vertical/time interpolation metadata | owns | validates/requests |
| Source optical diagnostics | preserves | selects/validates mode |
| Final spectral optical coefficients | never claims | owns |
| Curved-Earth multiple scattering | never | owns |
| Observer/source domain tail | provides fields/bounds | owns termination |
| Display tiles | derives separately | never consumes as colour |

# Environment Atlas consumer contract

## 1. Purpose and ownership

Physics consumes two independently releasable products from the sibling
[`environment-atlas/`](../../../environment-atlas/README.md) workspace:

- `EmissionRelease`, governed in detail by the
  [emission contract](EMISSION_RELEASE_CONTRACT.md); and
- `AtmosphereFieldRelease`, a four-dimensional environmental state over
  longitude, latitude, altitude/vertical coordinate, and valid time.

The products share provenance and delivery conventions, but neither is required
to have the same build cadence, coverage, resolution, or release identifier.
An optional `EnvironmentReleaseSet` manifest only names a tested compatible pair.

Environment Atlas owns source acquisition, harmonisation, data fusion,
downscaling, climatological fallback construction, chunks, evidence classes,
uncertainty, and release manifests. Physics owns conversion from environmental
state to wavelength-dependent optical properties and every radiative-transfer
calculation. Viewer owns display tiles and scenario selection. No display product
is a Physics input.

The repository [unified system contract](../../../docs/system-contract.md) is
normative for product/type names, selection/evidence vocabulary, time identities,
scientific validity, revision fields and coarse runtime method names.

## 2. Runtime interface

The conceptual state interface is coarse and region-oriented:

```text
AtmosphereFieldProvider
  open_atmosphere_release(manifest, dictionaries) -> atmosphere_release_handle
  resolve_atmosphere_selection(handle, requested_time_utc, policy)
      -> AtmosphereSelection
  plan_atmosphere_query(handle, curved_earth_region, vertical_support,
                        variables, selection, lod) -> ChunkPlan
  register_chunk(atmosphere_release_handle, chunk_descriptor, bytes)
      -> chunk_handle
  query_atmosphere(handle, request) -> AtmosphereStateVolume
  release_handle(handle)
```

`query_atmosphere` returns contiguous arrays for a path bundle or bounded 3-D region,
not one JavaScript object per point. Native and Wasm decoders must pass the same
conformance fixture. The browser may decode and interpolate regional chunks; it
does not run a global weather model or data assimilation.

## 3. Required preserved semantics

Every query and returned volume preserves:

- `atmosphere_schema_revision`, `atmosphere_model_revision`,
  `atmosphere_release_id` and exact chunk/content hashes;
- provider/dataset lineage, `source_run_id`, `analysis_time_utc`,
  `valid_time_utc`, `lead_duration`, ensemble/member or climatology/standard
  identity, `observation_correction_revision`, `climatology_model_revision`, and
  `AtmosphereSelectionMode`;
- horizontal CRS/datum, cell support, vertical-coordinate family and coefficients,
  time interval/support, interpolation policy, and extrapolation flags;
- quantity identity, units, basis/speciation, `DataValidity`, per-field
  `SourceEvidenceClass`, and
  ambient-wet versus dry/reference-state optical convention;
- uncertainty/ensemble summaries, representativeness and resolution limits,
  quality flags, fusion/downscaling method, provenance and licence partition;
- climatology distribution/sample identity and conditioning variables when a
  climatological realization is selected.

The minimum useful state families are pressure, temperature, humidity/water
vapour, ozone where available, winds, aerosol species or size-bin mass/mixing
ratios, PM diagnostics, clouds and precipitation/hydrometeors, and relevant
surface state. Provider AOD, extinction, single-scattering albedo and asymmetry
may be retained as diagnostics or constrained optical inputs, with their native
wavelength and humidity convention explicit.

## 4. Physics conversion rules

Physics creates a versioned `OpticalAtmosphereState` from the returned state. It
owns gas number density and absorption, Rayleigh scattering and refractivity,
aerosol hygroscopic growth and mixture optics, cloud optical closure, phase
representations, wavelength projection, and curved-ray interpolation.

The adapter must not:

- substitute PM2.5, PM10, AOD or visibility alone for a complete optical state;
- apply humidity growth twice when provider optical coefficients already describe
  ambient-wet aerosol;
- interpret a missing aerosol, cloud, profile or grid cell as clean/clear air;
- silently replace unavailable values with a named city or weather preset;
- independently interpolate variables in ways that break mass, hydrostatic,
  cloud, or aerosol correlations;
- infer exact street-scale pollution from a coarse model or station.

When state is insufficient, the result is explicitly unavailable, bounded, or
scenario-dependent. Any closure assumption is named, revisioned, and included in
the result uncertainty.

## 5. Spatial domain and Earth geometry

The atmosphere query covers the source-to-observer propagation volume plus a
conservative scattering support region, not merely the observer's vertical
column. This is required for polluted urban plumes that scatter light before it
travels into cleaner countryside, broken cloud, elevated aerosol layers, and
Earth-curvature effects.

Environment Atlas supplies geolocated state and support. Physics converts it into
its spherical/oblate geometry, integrates along straight or refracted curved rays,
selects adaptive cells/layers, and terminates the domain using radiance/error
bounds. A flat map distance or fixed-radius city glow is not the transfer model.

## 6. Time and fallback policy

The scenario selects one declared `AtmosphereSelectionMode`:

```text
observation_adjusted_analysis | analysis | forecast | reanalysis |
climatology_sample | standard_scenario | insufficient
```

Forecast requests preserve the model run, valid time, lead and ensemble/member
semantics. Historical requests prefer an appropriate reanalysis. Far-future or
otherwise unsupported requests use a sample/quantile from a joint conditional
climatology keyed by location, season, local time and weather regime. Independent
per-variable medians are forbidden because they create physically inconsistent
humidity, cloud, aerosol and boundary-layer combinations. A climatology is never
labelled as a forecast.

## 7. Caching and invalidation

Optical-state and transfer cache keys include `atmosphere_release_id`, exact
chunks, `source_run_id`, analysis/valid/lead/member or climatology/standard ID,
`observation_correction_revision`, `climatology_model_revision`,
interpolation/downscaling revision, `atmosphere_optics_model_revision`, vertical
and spectral grids, and geometry. An updated
forecast or analysis cannot overwrite an immutable prior product. Only complete,
validated volumes enter shared caches; cancellation cannot publish partial state.

## 8. Validation

The shared fixture set includes:

- exact chunk decoding and coordinate/vertical reconstruction;
- pressure/hydrostatic and mass/column conservation;
- wet/dry aerosol cases that expose double humidity application;
- clear, aerosol, elevated plume, broken-cloud and city-to-rural path volumes;
- selection mode, forecast run/member, observation-correction and climatology-model/sample or standard identity preservation;
- missing/censored fields and licence/provenance round trips;
- native/Wasm parity and boundary interpolation tests.

Physics additionally validates derived optical depth, transmission, phase
normalization and radiance against independent observations and reference solvers.

# Four-dimensional atmospheric field model

## 1. Product concept

`AtmosphereFieldRelease` is a collection of immutable source runs, normalized fields, derived climatology components, uncertainty and provenance. A runtime query returns an `AtmosphereStateVolume` over a geodesic region, altitude range and time—not a single weather preset.

## 2. Source evidence classes

```text
direct_observation
assimilated_analysis
forecast
reanalysis
regional_enrichment
observation_correction
seasonal_anomaly
climatology
inferred_prior
explicit_standard
missing
```

This is the canonical `SourceEvidenceClass` from the [unified system contract](../../../contracts/README.md). Every variable can have a different class. A forecast column may have model humidity, station-corrected surface PM and satellite-constrained AOD. The output preserves this mosaic and correlations rather than assigning one misleading global label. Runtime selection is represented separately by `AtmosphereSelectionMode`.

## 3. Required state families

### Molecular meteorology

- pressure or hybrid-level coefficients plus surface pressure;
- temperature;
- specific humidity/water-vapour mixing ratio; relative humidity may be retained but must state saturation convention;
- geopotential/geometric height and gravity convention;
- horizontal/vertical wind;
- ozone and other optically material gas profiles where supported;
- boundary-layer height and stability diagnostics.

### Aerosol/composition

- species/bin mass mixing ratios or concentrations: dust, sea salt, sulfate, nitrate, ammonium, organic matter, black carbon and provider-specific secondary aerosol;
- dry/wet state convention and air density needed for conversion;
- PM1/PM2.5/PM10 diagnostics and their provider formula;
- AOD by species/total and wavelength;
- 3-D extinction/backscatter plus spectral SSA/asymmetry when supplied;
- source/model aerosol family and hygroscopic treatment revision.

### Clouds and hydrometeors

- cloud fraction/overlap semantics;
- liquid and ice water content/mixing ratio;
- rain and snow/graupel where relevant;
- phase, effective radius/number concentration when supported;
- cloud-base/top or provider diagnostic;
- source optical depth diagnostics with wavelength/assumptions.

### Surface/context

- terrain and surface pressure consistency needed to reconstruct the atmospheric columns;
- land/sea, snow/ice and surface roughness/albedo references needed to interpret the source model;
- urban/rural/traffic/industrial/marine/dust/fire regime probabilities used by any downscaler.

These are contextual fields inside `AtmosphereFieldRelease`, not an authoritative
transfer BRDF or terrain/horizon product. Physics selects its own
`SurfaceTerrainProduct` and reconciles its surface geometry with atmospheric
terrain masks exactly once under a revisioned policy.

## 4. Coordinates and vertical representation

- Horizontal coordinates are WGS84 geodetic with source grid/projection retained.
- Runtime tiling may use a cube sphere, HEALPix-like surface hierarchy or coarse H3 addressing, but H3 centres/areas do not replace physical geometry.
- Native hybrid sigma-pressure levels are preserved or losslessly reconstructable from `a`, `b` and surface pressure. Pressure-level products are never mislabelled as uniform altitude.
- Geopotential, geopotential height, geometric height above ellipsoid and height above terrain are distinct typed quantities.
- Terrain-intersecting/model-below-ground levels use explicit masks and a reviewed surface extrapolation policy.
- Physics receives monotonic columns in its requested coordinate with conservative mappings and error metadata.

## 5. Temporal representation

```text
SourceRunIdentity {
  source_run_id
  provider_id
  system_model_version
  analysis_time_utc
  valid_time_utc
  lead_duration
  ensemble_member_id
  processing_time_utc
  publication_time_utc
}
```

Forecast interpolation never crosses different runs without an explicit policy. Reanalysis and climatology store calendar/leap-day/local-solar-time conventions. Time zones are irrelevant to fluid state except where an anthropogenic prior explicitly uses civil schedules.

## 6. Normalized chunk

Conceptual structure:

```text
AtmosphereChunk {
  atmosphere_schema_revision
  atmosphere_model_revision
  atmosphere_release_id
  source_run_id
  horizontal_support and native_effective_resolution
  vertical_coordinate and levels
  valid_time_utc and time_support
  ensemble/member axis?
  variables[] {
    quantity, unit, storage_type, scale_offset
    values, DataValidity mask, QA, SourceEvidenceClass
    uncertainty/ensemble statistics
    provenance/source-variable transform
  }
  cross_variable_correlation_or_sampling_model?
}
```

Large variables are structure-of-arrays contiguous buffers. No per-voxel JavaScript objects are permitted.

## 7. Uncertainty

Keep separable:

- observation/retrieval uncertainty;
- analysis/ensemble spread;
- model structural and representativeness uncertainty;
- spatial/vertical/time interpolation;
- downscaling/inferred-prior uncertainty;
- climatology sampling and finite-baseline uncertainty;
- provider optical-diagnostic versus Physics optical-model discrepancy.

An ensemble is not automatically calibrated uncertainty. Validation may add lead/region/season-dependent error models without erasing raw ensemble spread.

## 8. Invariants

- Mixing ratios, concentrations, column integrals and optical depths cannot be interchanged without density/path metadata.
- Relative humidity is bounded and tied to water/ice saturation convention; supersaturation policy is explicit.
- Non-negative mass/cloud fields use conservative interpolation or report any correction.
- Vertical integration of 3-D extinction should reproduce source AOD within provider tolerance when both are from the same optical system.
- Regridding conserves dry-air/aerosol mass or column quantity where declared; intensive variables use appropriate weighted interpolation.
- Missing is never zero or clear sky.
- `DataValidity`, source evidence, uncertainty and runtime availability remain separate axes.

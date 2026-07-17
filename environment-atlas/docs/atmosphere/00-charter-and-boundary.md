# Atmospheric-state charter and boundary

## Mission

Produce a compact, global, four-dimensional and uncertainty-aware environmental field for arbitrary Night Glow observer scenarios. It must represent spatially heterogeneous urban plumes, cleaner surrounding air, vertical boundary-layer structure, humidity-driven aerosol growth, clouds and long-range transported dust/smoke on a curved Earth.

## Required questions

A query must be able to answer:

- Which `AtmosphereSelectionMode` applies: `observation_adjusted_analysis`, `analysis`, `forecast`, `reanalysis`, `climatology_sample`, `standard_scenario`, or `insufficient`?
- What are pressure, temperature, humidity, wind and relevant hydrometeor/aerosol species at each supported height and surrounding location?
- Which exact `SourceEvidenceClass` applies to each variable: `direct_observation`, `assimilated_analysis`, `forecast`, `reanalysis`, `regional_enrichment`, `observation_correction`, `seasonal_anomaly`, `climatology`, `inferred_prior`, `explicit_standard`, or `missing`?
- What spatial/vertical/time support and interpolation apply?
- What uncertainty, ensemble spread, scientific validity, representativeness and missingness remain?
- Which source run, product version, licence and transformation produced the value?

## Primary products

- **Historical reanalysis release:** stable reconstruction for past dates.
- **Operational analysis/forecast channel:** frequently updated, run- and lead-time-specific.
- **Climatology release:** season × local-time × location/regime distributions and correlations.
- **Observation correction/validation packs:** station, AERONET, lidar and satellite subsets with strict licence partitions.
- **Explicit standard scenarios:** public standard atmosphere plus named aerosol/cloud assumptions, never presented as local evidence.

## Non-goals

- Running ECMWF/NOAA/CAMS-class global models in the browser.
- Predicting local weather deterministically beyond scientific forecast skill.
- Inferring vertical aerosol structure from one surface PM measurement without a model and uncertainty.
- Treating AOD as surface PM, PM as extinction, visibility as a phase function, or humidity as aerosol mass.
- Encoding one universal urban/rural multiplier.
- Computing wavelength-dependent optical closure or light propagation.
- Correcting the emission release to compensate for atmospheric-model errors.

## Ownership

| Concern | Environment Atlas atmosphere domain | Physics |
| --- | --- | --- |
| Provider files, QA, run/version/licence | owns | consumes lineage |
| Unit/coordinate/vertical/time normalization | owns | validates contract |
| Model/observation/climatology fusion | owns | consumes state/uncertainty |
| Aerosol/hydrometeor mass and source optical diagnostics | owns as data fields | consumes |
| Spectral molecular/aerosol/cloud optical coefficients | preserves source diagnostics only | owns final construction |
| Curved-Earth path integration and multiple scattering | never | owns |
| Display tiles and legends | supplies derived values/metadata | Viewer owns rendering |

## Success criteria

- A city plume can differ horizontally and vertically from its surroundings without being tied to the observer cell.
- Forecast lead time and uncertainty are visible in the product identity.
- Far-future output is probabilistic climatology with correlations, not independent slider medians.
- Native/regridded vertical columns conserve dry-air, water and aerosol quantities to declared tolerances where mathematically applicable.
- CAMS/ERA5 and MERRA-2 cross-comparisons expose structural disagreement rather than averaging it away.
- A legally redistributable tiny fixture supports native and Wasm conformance.

The repository-wide [unified system contract](../../../docs/system-contract.md) is normative for these enum names, time identities and the distinction between evidence, selection, scientific validity and runtime availability.

# Validation, licensing and risks

## 1. Validation hierarchy

### Adapter and unit validation

- exact GRIB/netCDF/Zarr variable, unit, scale/offset, missing and QA decoding;
- hybrid/model/pressure/geopotential/geometric-height transformations;
- WGS84, longitude wrap, time/run/lead/member identity;
- vertical/horizontal/time interpolation invariants and conservation;
- native versus Wasm decode parity.

### Source closure

- re-integrated 3-D CAMS extinction against CAMS AOD where compatible;
- reconstructed PM diagnostics against provider formulas/species/air density;
- water/cloud mass and layer masks against source diagnostics;
- regridded columns against source integrals;
- exact round-trip for non-lossy fixture fields and declared error for quantized fields.

### Independent evidence

- CAMS/ERA5 against MERRA-2 structural differences;
- AOD/spectral optics against held-out AERONET Level 2;
- surface PM/species against held-out EEA/EPA background sites, with traffic sites separate;
- vertical aerosol/cloud against CALIPSO/EarthCARE/OMPS;
- cloud top/optical properties against geostationary/polar satellite products;
- meteorology against radiosondes/stations.

### End to end

Pin emission, atmosphere and Physics releases; compare calibrated all-sky observations across clear/humid/hazy/dust/smoke/low-cloud cases. Keep source, atmospheric, Physics numerical and display residuals separable. Do not tune atmospheric fields solely to improve sky brightness.

## 2. Required geographic fixtures

- Warsaw/central Europe: continental urban aerosol, EEA/CAMS coverage.
- Delhi NCR: severe urban/regional aerosol and shallow boundary layers.
- Lagos/coastal tropics: humidity, marine/urban aerosol and cloud.
- Los Angeles basin: topography, photochemical aerosol and EPA/AERONET evidence.
- Saharan dust path to dark/marine observer.
- Canadian/Australian biomass-smoke event.
- clean high-altitude and remote marine controls.
- polar/winter case with sparse aerosol retrieval and unusual vertical structure.

Each has historical instants with independent evidence, not only visually interesting defaults.

## 3. Acceptance metrics

- bias/RMSE/correlation and calibrated coverage of intervals by variable, altitude, regime, season and lead;
- profile/AOD/PM closure and mass-conservation residual;
- boundary-layer height and plume-gradient errors;
- cloud detection/top/optical-category scores;
- climatology quantile reliability and cross-variable physical consistency;
- urban/rural residual improvement on held-out cities/continents;
- bytes, decode/query latency, peak native/Wasm memory and cancellation;
- Physics sky-radiance sensitivity to atmospheric uncertainty versus numerical error.

## 4. Licence policy

Access is not redistribution permission. Every source manifest records exact dataset licence and accepted terms at retrieval time.

Preferred foundations:

- ERA5/CAMS/ECMWF open products explicitly marked CC BY 4.0, with required attribution and terms;
- NASA-led Earthdata generally CC0 unless a product says otherwise, with strong dataset citation;
- NOAA US-government products/public-domain status verified per collection;
- GHSL CC BY 4.0;
- EEA products with per-dataset metadata/CC BY where stated.

Risks:

- OpenAQ aggregates provider-specific licences and cannot grant rights it does not hold;
- seasonal/S2S systems may mix CC BY and non-commercial contributors;
- national weather services can impose different conditions;
- APIs may permit queries but restrict bulk caching/redistribution;
- model-derived releases may be adaptations requiring attribution/change notices.

The build system partitions open-redistributable, attribution-only, non-commercial/research-only and access-only inputs. Public runtime releases use only compatible partitions unless an adapter fetches source data directly under user-authorized terms.

## 5. Major risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Coarse model creates false city detail | effective-resolution metadata, conservative residual model, held-out validation |
| Surface PM assigned through whole column | separate support operators; vertical model/lidar constraint |
| AOD mistaken for PM/extinction profile | typed quantities and source-closure tests |
| Humidity double-counted in source and Physics optics | wet/dry/source-optics convention in contract |
| Operational model upgrade corrupts climatology | reanalysis baseline, source system version and bias segments |
| Clouds dominate compute/uncertainty | named cloud fidelity tiers and explicit subgrid/overlap uncertainty |
| Forecast presented as truth | ensemble/lead/evidence in every result and UI |
| Far-future fake precision | joint climatology distribution and visible fallback |
| Global archive cost explodes | region/time/variable probes, cloud-native subsetting and derived compact releases |
| Licence contamination | source/output partitions and automated attribution/audit |
| Atlas starts duplicating Physics | strict state-versus-optics handoff and independent tests |

## 6. Release gate

No product becomes the default Physics input until its source adapter, legal partition, unit/coordinate closure, independent validation, browser decode, uncertainty and representative geographic cases pass. Availability of a provider API or a smooth globe layer is not an acceptance test.


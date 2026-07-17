# 03. Data-source catalog

The status labels are design decisions: **baseline** is required, **cross-check** is independently compared, **prior** may redistribute or classify, **enrichment** may replace a local posterior after validation, and **validation** is not used to train the evaluated split.

## A. Nighttime radiometry

| Source | Coverage / resolution | Supported use | Major limitations | Status |
| --- | --- | --- | --- | --- |
| NASA Black Marble C2 VNP46A2 / VJ146A2 | Global daily, 15 arc-second grid, 2012+ for SNPP and 2018+ for NOAA-20 | Corrected surface upward DNB radiance, QA-aware temporal samples | Panchromatic 500–900 nm; polar-orbit local-time sampling; gap filling; residual contamination | **Baseline** |
| NASA Black Marble C2 A3/A4 | Global monthly/yearly | Stable reference editions and seasonal deltas | Aggregation can hide observation geometry and intramonth events; read all QA/count layers | **Baseline derivative** |
| EOG VIIRS monthly/annual VNL | Approximately 15 arc seconds, broad global coverage | Independent composite, masks, historical comparison, prototype | Variant-specific stray-light/ephemeral filtering; latitude and year coverage differ | **Cross-check/fallback** |
| DMSP-OLS stable lights | Global historical, about 1 km / 30 arc seconds | Long-run historical context only | Saturation, blooming, coarse resolution, inter-satellite calibration | Research only |
| ISS astronaut photographs | Irregular global patches, sometimes ~4 m | City-scale spatial and visible-colour calibration | Not systematic; variable cameras/settings/view; geolocation and radiometric calibration required | **Enrichment/validation** |
| SDGSAT-1 Glimmer | Selected acquisitions; 10 m PAN, 40 m RGB | Fine spatial/spectral studies where permission permits | Scientific non-commercial terms; no redistribution or derivative compilation without permission | Isolated research pack |
| Luojia-1-01 | Selected coverage, ~130 m | Spatial patch experiments | Access, calibration, current availability, and licence require audit | Candidate enrichment |
| TEMPO nocturnal experiments | Regional geostationary field, spectral | Experimental spectral/within-night calibration | Not designed as global night sensor; twilight/background correction; regional | Research calibration |

### Mandatory Black Marble layers

The ingestor must preserve at least radiance, mandatory quality flag, cloud-mask quality, snow/ice state, gap-filled versus direct retrieval, latest-high-quality date, sensor/platform, acquisition geometry where available, and observation/sample count. The baseline recipe should prefer direct high-quality, cloud-free, snow-free retrievals and publish a separate snow scenario rather than averaging snow enhancement into ordinary emission.

## B. Spatial priors

| Source | Useful features | Role | Risk / handling |
| --- | --- | --- | --- |
| OpenStreetMap planet PBF | Roads by class, buildings, land use, industrial/commercial areas, parking, airports, sports, greenhouses, `lit=*`, `opening_hours`, lamp tags | Primary semantic redistribution prior | Coverage and tagging completeness vary; ODbL obligations; freeze one dated planet snapshot |
| DLR WSF 2019 | Global 10 m settlement mask | Geometry fallback and OSM completeness signal | 2019 epoch; binary settlement is not light; CC BY 4.0 |
| GHSL GHS-BUILT-S R2023A | Multitemporal global built-up surface | Built-fraction/epoch prior and cross-check | Built surface is not lamp intensity; cite exact release |
| WSF 3D | Global 90 m building fraction/height/volume | Urban-form class and possible facade/occlusion prior | Coarse and model-derived; separate from radiometry |
| Microsoft Global ML Building Footprints | Worldwide machine-derived footprints | Building fallback where OSM is sparse | ODbL; false positives/omissions; do not merge casually with non-ODbL distributable layers |
| Copernicus DEM GLO-30/GLO-90 | Global surface elevation | Source elevation and future terrain blocking | DSM includes structures/vegetation; licence and missing-tile handling |
| MODIS MCD43 BRDF/albedo 6.1 | Global 500 m daily/16-day support | Ground reflectance prior for the propagation stage | Not a source-brightness measurement; ensure current 6.1 product |

### OSM feature groups to preserve

- Road geometry and class, service roads, junctions, parking, rail yards.
- Building footprints and tags: residential, commercial, industrial, retail, civic, religious, greenhouse, warehouse.
- Land uses and facilities: industrial areas, ports, airports, stadiums, sports pitches, fuel, quarries, power facilities.
- Explicit lighting evidence: `lit`, `light_source`, `lamp_type`, `lamp_model`, `colour`, `colour_temperature`, `opening_hours`.
- Tunnels/covered roads and features known not to emit upward.

OSM tag presence is positive evidence; tag absence is not evidence of darkness.

## C. Temporal and activity evidence

| Source | Use | Constraint |
| --- | --- | --- |
| Black Marble daily series | Day-to-day, seasonal, holiday, outage, and long-run change near satellite overpass time | Does not supply a nightly curve |
| OSM `opening_hours` / `lit` | Object-specific schedule when semantically valid | Sparse and not guaranteed operationally current |
| Municipal lighting-control data | Streetlight dimming and switch-off schedules | Local, heterogeneous, often not open |
| Traffic/open mobility statistics | Scenario prior for vehicle-dependent light | Traffic is not light; calibrate locally before use |
| Electricity load curves | Broad activity prior | Aggregate load includes non-lighting; never directly scale pixels without validation |
| Sunrise/sunset/astronomical ephemeris | Convert UTC, civil time, solar time, and hours since sunset | Deterministic context, not a light measurement |

## D. Atmosphere and terrain inputs

Atmospheric sources are not embedded in an `EmissionRelease`. They are researched, normalized and published independently by this workspace's atmosphere domain as `AtmosphereFieldRelease` products. The authoritative, expanded catalogue is [../atmosphere/source-catalog.md](../atmosphere/source-catalog.md).

- CAMS global atmosphere/aerosol analysis, forecast, and reanalysis.
- NASA MERRA-2 aerosol diagnostics at roughly 0.5° × 0.625°, hourly/3-hourly/monthly products.
- ERA5 global hourly meteorology at about 31 km with 137 levels.
- Copernicus DEM for elevation and Earth screening.
- MODIS BRDF/albedo and snow products for surface reflection scenarios.

Physics needs wavelength-dependent aerosol/cloud properties and vertical distribution, not just a single visibility or PM number. Environment owns source selection/fusion and state uncertainty; Physics owns state-to-optics conversion and propagation. Both are validated separately from surface-source reconstruction.

## E. Ground validation

| Source | Measurement | Use |
| --- | --- | --- |
| Globe at Night | Human limiting-magnitude observations | Large global holdout with high individual uncertainty and sampling bias |
| TESS-W / STARS4ALL | Continuous zenith sky brightness and environmental channels | Time-of-night curves and long-term station validation |
| NPS Night Skies | Calibrated V-band all-sky mosaics/fisheye images and derived metrics | High-quality hemispheric validation, mainly United States |
| SQM research networks | Zenith/band-limited sky brightness | Dense temporal validation where instrument metadata is known |
| Municipal lamp inventories | Installed flux, CCT, shielding, controls | Local source-model calibration and completeness audit |

Ground observations validate the **combined source plus propagation chain**. They cannot by themselves identify which component caused an error, so calibration sites need paired source evidence and atmosphere/meteorology.

## F. Dataset admission checklist

Before a source enters a production manifest:

1. Stable landing page, version, DOI or snapshot identifier.
2. Physical quantity, units, calibration, support footprint, point-spread function, and no-data semantics documented.
3. Acquisition time/view geometry and QA layers available.
4. Coverage and known bias assessed on at least four continents and high latitudes.
5. Licence permits the intended processing and output redistribution, or the source is isolated behind a non-distributable enrichment boundary.
6. Raw-file checksum and retrieval log captured.
7. A tiny reproducible fixture is legally redistributable for tests.
8. Transformation into the normalized observation schema is reviewed and unit-tested.

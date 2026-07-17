# 10. Validation and acceptance gates

## Separate four validation layers

1. **Ingestion correctness:** source values, units, QA, geolocation, and metadata are decoded correctly.
2. **Source reconstruction:** the atlas predicts withheld fine nighttime radiance/inventories.
3. **Propagation physics:** a known source field and atmosphere predict measured sky radiance.
4. **End to end:** the public-data atlas plus atmosphere predicts ground observations.

Tuning all parameters against end-to-end SQM values alone is underdetermined and can hide a wrong source model behind a wrong aerosol/angle model.

## Ingestion tests

- Golden source pixels checked against provider tools/documentation.
- Unit-conversion dimensional tests.
- Exact handling for fill, negative/noise, saturation, gap-filled, cloud, snow, aurora, glint, and twilight flags.
- Raster footprint/area checks at equator, mid-latitude, date line, and poles.
- Cross-platform and cross-sensor comparisons on stable sites.
- Raw-to-normalized round trip with recorded metadata.

Acceptance: no unexplained scaling/geolocation discrepancy; all QA states preserved; deterministic normalized hashes.

## Conservation tests

For every refinement and package hierarchy:

```text
abs(sum(children J_DNB) - parent J_DNB)
    <= absolute_tolerance + relative_tolerance * parent J_DNB
```

Test before and after quantisation, across chunk borders and enrichment replacement. Report global/continental summed residual; never correct it with an unlogged scale factor.

## Spatial disaggregation evaluation

Use whole-city/whole-region holdouts stratified by:

- continent and income/development context;
- OSM completeness;
- compact versus diffuse urban form;
- road-grid, informal settlement, industrial, port, airport, greenhouse, and offshore source classes;
- terrain/vegetation;
- source brightness and satellite view geometry.

Metrics:

- integrated intensity bias and conservation residual;
- pixel/cell log-radiance MAE and RMSE above detection threshold;
- rank/correlation and structural similarity at several aggregation scales;
- spatial Earth-mover distance or equivalent distribution error;
- calibration/coverage of posterior intervals;
- false allocation into known-dark water/park/terrain regions;
- improvement over uniform, WSF-only, and OSM-density baselines.

The model must demonstrate transfer outside OSM-rich Europe before global rollout.

## Spectral and angular evaluation

- Forward-integrate inferred spectra through the exact DNB response and reproduce observed radiance.
- Compare against held-out calibrated RGB/spectrometer/inventory sites.
- Test blue-blind failure cases and LED retrofits explicitly.
- Compare inferred UEF against multi-angle or inventory-derived photometry.
- Evaluate long-distance predictions, which are sensitive to near-horizontal emission.
- Report uncertainty calibration, not only best-fit curves.

## Temporal evaluation

- Hold out nights and seasons at continuously monitored sites.
- Compare transition timing and factors for municipalities with known controls.
- Evaluate profile transfer to other cities separately from fit locations.
- Verify VIIRS-series models only at their acquisition phase unless independent within-night evidence exists.
- Report performance versus the unresolved constant reference; a complex prior must materially improve it.

## Ground end-to-end validation

Preferred sites pair:

- calibrated all-sky or zenith measurements with timestamps and spectral response;
- nearby source inventories/high-resolution imagery;
- aerosol/cloud/meteorology and elevation;
- multiple azimuths/distances from source regions;
- repeated nights across atmospheric conditions.

NPS calibrated V-band hemispheres are high-quality all-sky tests. TESS-W/SQM networks provide temporal density. Globe at Night provides global reach but needs robust treatment of participant, location, adaptation, weather, and selection bias.

Metrics include spectral/photometric zenith radiance, all-sky angular residual, artificial horizontal/hemispheric illuminance, light-dome azimuth and extent, distance-decay curves, and interval coverage.

## Initial release gates

- All ingestion goldens pass.
- Zero hierarchical overlaps and invalid profile references.
- Global/Europe conservation residual below the agreed quantisation error budget.
- Cross-sensor differences characterised and included in uncertainty.
- Disaggregation beats simple baselines on held-out regions without worsening sparse-OSM strata.
- Uncertainty intervals show acceptable empirical coverage.
- Restricted datasets are absent from open release lineage.
- A full Europe build completes reproducibly twice from the same recipe.
- At least one end-to-end validation report demonstrates where error comes from; absolute accuracy claims are limited to measured evidence.

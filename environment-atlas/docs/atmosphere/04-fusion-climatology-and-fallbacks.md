# Fusion, climatology and fallbacks

## 1. Reconstruction order

1. Select the `AtmosphereSelectionMode` for `requested_time_utc`.
2. Load one continuous meteorological/composition backbone over the full Physics source/path domain.
3. Normalize horizontal/vertical/time coordinates and variables without downscaling.
4. Apply provider QA and reject incompatible/corrupt fields.
5. Compare independent model source(s) and derive structural-disagreement diagnostics.
6. Assimilate or residual-correct only accepted observations at their real support.
7. Optionally downscale selected near-surface/spatial fields using conservative covariates.
8. Enforce physical consistency, conservation, bounds and column/diagnostic closure.
9. Package central/ensemble/climatological scenarios and uncertainty.

## 2. Do not naively average models

ERA5, CAMS and MERRA-2 are not independent sensor readings on identical grids. Each has its own model, assimilation and aerosol definitions. The first implementation selects an authoritative backbone per variable/time regime and uses alternatives for bias/error characterization. A multi-model blend requires held-out evidence demonstrating improvement and weights conditioned on region/season/variable.

## 3. Observation correction

Use a hierarchical residual model rather than overwriting voxels:

```text
observation = support_operator(model_field) + bias(regime, season, source) + residual
```

- Surface stations constrain a surface representativeness layer, not the whole vertical column.
- AERONET constrains spectral column AOD/optics in clear conditions.
- Lidar constrains layer boundaries/profile shape along tracks.
- Satellite AOD constrains column spatial pattern under retrieval QA.
- Cloud products constrain mask/top/optical properties but not a unique 3-D condensate field.

Corrections carry spatial/time decay, cross-validation and an uncertainty increase outside observation support.

## 4. Urban and source-region inference

Never encode `urban = rural × constant`. If the continuous model is too coarse, a named `urban_residual_model_revision` may use:

- CAMS/EDGAR sector emissions and GFAS fire injection;
- GHSL built fraction, height, population and degree of urbanisation;
- roads, ports, industry and land/sea/terrain covariates;
- boundary-layer height, stability, wind, precipitation and humidity;
- station type (traffic/industrial/background) and held-out rural/urban pairs;
- regional model residuals where available.

It predicts a bounded redistribution/additive residual at the supported variable (for example surface dry PM species), not a final optical coefficient. Mass/column conservation or explicit inventory-driven addition is declared. Unsupported regions return a wide climatological distribution, not confident fine pixels.

## 5. Climatology product

For each spatial/regime tile, fit a joint distribution conditioned on:

- day-of-year/season;
- local solar time and optionally weekday/civil activity where justified;
- synoptic regime or broad weather cluster;
- vertical level;
- urban/marine/dust/fire/vegetation/topographic regime;
- baseline period and trend policy.

Store robust central values, quantiles, extremes/tails, covariance or a compact latent sampler. Critical correlations include humidity–aerosol water uptake, stability–boundary-layer height–surface concentration, cloud fraction–condensate, wind–plume direction and precipitation–washout.

Do not build a “median column” by independently taking each variable's median; it may be physically inconsistent.

## 6. Query-time selection ladder

```text
1. observation_adjusted_analysis where accepted corrections support the requested domain/time
2. analysis for a current valid analysis
3. forecast with exact source run, valid time, lead and ensemble selection
4. reanalysis for a supported historical instant
5. climatology_sample, optionally conditioned by a seasonal anomaly
6. standard_scenario with a named molecular/aerosol/cloud definition
7. insufficient
```

Each selection is returned as `AtmosphereSelectionMode`, while per-field lineage remains `SourceEvidenceClass`. Users may explicitly request dry/clear/urban-haze standard scenarios, but defaults never conceal the fallback and the UI never calls climatology or a standard scenario a forecast.

## 7. Far future and climate change

For dates beyond seasonal skill, baseline climatology is the default. A future climate-scenario mode may apply CMIP/seasonal anomalies to large-scale temperature/humidity/cloud statistics only after downscaling and bias-correction research. Future aerosol pollution depends on policy/emissions and must be a separately named scenario, not extrapolated automatically from today.

## 8. On-the-fly work

Safe browser-time computations include time interpolation within one run, vertical coordinate conversion, regional chunk assembly, correlated climatology sampling and small residual application. Global ingestion, hybrid-level remapping, model training and climatology fitting are native precompute.

# 04. Physical data model

## 4.1 The baseline measured quantity

Black Marble surface radiance is reported as:

```text
L_DNB [nW cm^-2 sr^-1]
```

Convert units exactly:

```text
1 nW cm^-2 sr^-1 = 1e-5 W m^-2 sr^-1
```

For a source footprint or exact overlap area `A` on the ellipsoid, define the conserved directional quantity:

```text
J_DNB = integral_A L_DNB(x) dA       [W sr^-1]
```

`J_DNB` is DNB-band directional radiant intensity integrated over emitting surface area for the product's corrected reference view convention. It is suitable for conservative raster-to-cell redistribution. It is **not** total hemispheric upward power.

If and only if a normalized upward emission function `u(theta, phi, lambda)` is known, a model can infer angular radiance and integrate a hemispheric flux. The conversion and its uncertainty belong in a named inference stage.

## 4.2 Normalized observation schema

Every ingestor first produces immutable normalized observations, before fusion:

| Field | Meaning |
| --- | --- |
| `observation_id` | Stable hash of source, asset, band, pixel/feature, and transform version |
| `source_dataset_id` | Manifest key including product and collection/version |
| `sensor_id` | SNPP-VIIRS, NOAA20-VIIRS, ISS camera, municipal inventory, etc. |
| `footprint` | Exact polygon or referenced raster support, WGS84 coordinates |
| `acquired_at` | UTC interval; never date-only if the source provides time |
| `reference_view` | Zenith/azimuth or declared composite convention |
| `quantity_kind` | Surface radiance, TOA radiance, installed flux, spectrum, schedule, geometry prior, etc. |
| `value` / `unit` | SI-normalized value plus original value/unit |
| `spectral_response_id` | Versioned sensor response curve or spectral band definition |
| `quality_bits` | Lossless source QA plus normalized quality categories |
| `censoring` | detected, below detection, saturated, clipped, missing, gap-filled |
| `uncertainty` | Distribution/interval and derivation; unknown is allowed |
| `licence_partition` | Determines which release products may contain derivatives |
| `provenance_hash` | Raw asset checksum and transform/config revision |

## 4.3 Cell posterior record

The final surface atlas uses spatial cell records with shared profile dictionaries. The conceptual record is:

```text
CellPosterior {
  cell_id
  reference_epoch
  dnb_directional_intensity
  dnb_uncertainty
  spectrum_profile_id
  angular_profile_id
  temporal_profile_id
  elevation_summary_id
  evidence_bits
  quality_class
  posterior_method_id
}
```

Profile IDs point to versioned dictionaries rather than repeating vectors in every cell. Each profile contains a central estimate, uncertainty representation, evidence class, valid epoch/region, and whether it is measured, inferred, assumed scenario, or unresolved.

## 4.4 Required evidence states

At minimum, distinguish:

- direct high-quality radiance retrieval;
- temporally gap-filled radiance;
- radiometric cross-check only;
- high-resolution nighttime imagery;
- complete/partial municipal inventory;
- OSM redistribution;
- built-surface redistribution;
- spectrum measured/inferred/unresolved;
- angle measured/inferred/unresolved;
- nightly profile measured/policy/inferred/unresolved;
- geometry-only proxy;
- transient source class such as fire, flare, vessel, aurora, or event;
- snow/ice scenario;
- below detection versus no observation.

## 4.5 Uncertainty model

One percentage is insufficient. Use separable components:

1. **Radiometric:** calibration, noise, sensor response degradation, composite variance.
2. **Sampling:** number of good observations, temporal variability, acquisition geometry.
3. **Spatial allocation:** ambiguity when redistributing inside a coarse support.
4. **Spectral:** unobserved wavelengths and source-mixture uncertainty.
5. **Angular:** uncertainty in shielding/reflection and near-horizontal emission.
6. **Temporal:** uncertainty away from the reference overpass phase.
7. **Model discrepancy:** residual learned from validation, spatially stratified.

V1 can encode compact quantiles or log-standard deviations per component plus profile-level covariance. Monte Carlo ensembles are generated offline for validation; the consumer should not need a full covariance matrix per cell.

## 4.6 Invariants

- Parent and descendant H3 cells never coexist in one canonical layer.
- Conservative refinement preserves summed `J_DNB` within the configured tolerance after quantisation.
- A prior cannot turn a no-observation area into measured emission.
- A source classified as unresolved cannot acquire a non-zero spectral/angular/time profile through serialization defaults.
- All dimensional quantities have schema-declared SI units; display units are downstream.
- A profile's reference normalization is explicit. Temporal factors equal 1 at the stated reference phase/epoch.
- Release chunks include the dictionary versions and cannot be decoded against a different profile set.
- Missing source evidence and zero posterior emission are encoded differently.

## 4.7 Transient and non-settlement lights

Gas flares, offshore platforms, fishing fleets, fires, and temporary events do not fit settlement geometry. They require separate source classes and temporal behavior. Stable industrial/offshore sources may remain in annual editions with their actual spatial support; fires and short events belong in optional temporal deltas. The global model must not mask every non-OSM light simply because no road/building explains it.

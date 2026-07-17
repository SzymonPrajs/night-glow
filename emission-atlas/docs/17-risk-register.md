# 17. Risk register

| Risk | Likelihood / impact | Detection | Mitigation |
| --- | --- | --- | --- |
| DNB radiance is presented as total visible/upward power | High / critical | Dimensional review; LED/UEF counterexamples | Preserve `J_DNB`; require named spectrum/UEF for conversion |
| Blue LED emission is missed | Certain in some degree / critical | Calibrated colour/inventory and ground residuals | Unknown spectral support, regional enrichment, uncertainty/scenarios |
| OSM-rich places look brighter merely because mapped better | High / high | Error versus completeness/continent | Conserve radiance; completeness-controlled prior; WSF/GHSL fallback |
| Coarse imagery is sharpened into false roads/buildings | Medium / high | Whole-city fine-image holdouts and spatial uncertainty | Forward PSF model, regularisation, adaptive resolution, retain coarse cells |
| Atmospheric effects are corrected twice | Medium / critical | End-to-end unit/path audit | Strict source/propagation boundary and metadata |
| A fixed 150 km radius misses distant cities | High for clean/high sites / high | convergence tests to 1,000 km+ | Adaptive tail bound and configurable ceiling |
| VIIRS 01:30 sample is treated as dusk-to-dawn behavior | High / high | profile evidence audit | unresolved global default; local measured/policy profiles only |
| Snow/cloud/aurora/fires/flares contaminate stable atlas | High / high | QA and time-series outlier reports | Separate flags/layers and source classes; robust composites |
| Vegetation masking creates seasonal bias | Medium / high | leaf-on/off site studies | retain season, add correction/uncertainty only after validation |
| Spatial and atmosphere models compensate each other's errors | High / critical | separate source and propagation holdouts | four-layer validation and frozen interfaces |
| ODbL/restricted imagery makes public release non-compliant | Medium / critical | provenance graph and legal audit | licence partitions, clean build graphs, restricted-source rejection |
| Global daily download grows to multi-TB/year unnecessarily | High / high | acquisition estimate and cache report | annual/monthly baseline; daily only on selected study tiles unless justified |
| Dense global H3 design explodes to hundreds of millions of records | High / high | Europe cardinality projection | sparse mixed resolution and coarse coverage metadata |
| Quantisation clips rural or extreme sources | Medium / high | distribution/error sweep including flares | schema sentinels, wider code or class-specific layer, reject saturation |
| Profile dictionary overgeneralises cities | High / medium | transfer holdouts and interval coverage | evidence-scoped profiles, joint families, unresolved fallback |
| High-latitude coverage is silently poor | High / medium | latitude/season QA maps | explicit coverage/no-evidence, specialised seasonal recipe |
| Offshore/industrial sources are erased by settlement masks | Medium / high | residual maps over water/known flares | non-settlement source classes; geometry is a prior, not a mask |
| Build cannot be reproduced after source updates | Medium / high | repeat build and hash comparison | immutable asset IDs/checksums/recipes and content-addressed stages |
| Restricted data leaks through trained models/caches | Medium / critical | provenance/license-class scanner | isolated storage/build graph, model-output review, open-only release CI |
| Ground citizen-science sampling bias drives calibration | High / medium | stratified professional/citizen comparison | robust weighting, professional anchors, holdouts, report selection bias |

## Product communication risk

The UI can turn a nuanced posterior into a falsely authoritative map. Every consumer must expose:

- surface emission versus propagated skyglow;
- reference epoch/time and active scenario;
- uncertainty/quality/coverage;
- whether spectrum, angle, and temporal profile are measured, inferred, or unresolved;
- data attribution.

Smooth rendering may interpolate for display, but the scientific query result and provenance must remain accessible. A visually detailed map is not evidence of high measurement resolution.

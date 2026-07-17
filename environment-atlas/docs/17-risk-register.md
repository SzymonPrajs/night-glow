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
| Physics assumes total flux/spectrum from `J_DNB` | Medium / critical | boundary conformance fixture and dimensional review | tagged unresolved profiles; explicit scenario policy; DNB forward-closure test |
| Initial ground reflection is applied twice | Medium / critical | direct/first-reflected boundary audit | consume atlas value as outgoing surface signal; BRDF only for later transport orders |
| Environment domains and Physics silently drift in schema/profile meaning | Medium / critical | compatibility matrix and shared fixtures in all suites | domain-owned schemas, unified vocabulary, pinned versions, one-way dependency, reject unknown mandatory semantics |
| Emission and atmosphere releases become falsely coupled | Medium / high | release graph and cadence review | independent schemas/models/releases; optional compatibility manifest only |
| Observer weather is used for the whole light path | High / critical | city-to-rural/elevated-plume fixtures | publish/query regional 4-D volumes; Physics owns curved-Earth domain selection |
| PM or AOD is treated as a complete optical atmosphere | High / critical | dimensional/closure review and spectral tests | retain species/profile/optical diagnostics; explicit Physics closure and uncertainty |
| Aerosol humidity growth is applied twice | Medium / critical | ambient-wet versus dry fixture pairs | mandatory wet/dry metadata and closure compatibility checks |
| Missing atmospheric values become clear air | High / high | sentinel/masked fixtures | explicit missing/censored/evidence states; bounded scenario or insufficient evidence |
| Coarse model/station fusion claims street-scale truth | High / high | spatial holdouts and resolution audit | bounded residuals, representativeness uncertainty, honest UI resolution |
| Far-future climatology is labelled as forecast | Medium / high | scenario/UI contract tests | `AtmosphereSelectionMode` and sample identity are mandatory; joint climatology label |
| Operational provider/licence change breaks publication | Medium / high | source-term and run-ingest monitoring | per-dataset licence partitions, provider adapters, immutable last-known releases |
| Atmospheric volume overwhelms browser memory/network | High / high | regional query/heap benchmarks | variable/level/time subsetting, multiresolution chunks, bounded cache and LOD |

## Product communication risk

The UI can turn a nuanced posterior into a falsely authoritative map. Every consumer must expose:

- surface emission, atmospheric state/display statistic, and propagated skyglow;
- reference epoch/time, `AtmosphereSelectionMode`, forecast run/lead or climatology/standard identity, and active scenario;
- separate `DataValidity`, domain status, evidence, uncertainty and numerical convergence;
- whether spectrum, angle, and temporal profile are measured, inferred, or unresolved;
- data attribution.

Smooth rendering may interpolate for display, but the scientific query result and provenance must remain accessible. A visually detailed map is not evidence of high measurement resolution.

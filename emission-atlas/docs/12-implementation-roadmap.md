# 12. Ordered implementation roadmap

No production code should be written before Phase 0 is reviewed. Each phase ends in an evidence artifact and a go/no-go gate.

## Phase 0 — Design review (current)

Deliverables:

- this documentation set;
- source/quantity/licence matrix;
- normalized observation and cell-posterior conceptual schemas;
- open questions ranked by blocking power;
- first experiment plan.

Gate: agree that the product is a source atlas, that `J_DNB` is the conserved measured quantity, and that spectrum/angle/time may remain unresolved.

## Phase 1 — Minimal Rust workspace and fixtures

Create workspace crates only after review:

| Crate | Responsibility |
| --- | --- |
| `atlas-schema` | Quantities, units, IDs, QA/evidence, normalized records; no I/O framework |
| `atlas-core` | H3 hierarchy, conservative refinement, profile semantics, query model |
| `atlas-format` | Versioned chunk/dictionary encode/decode and validation |
| `ingest-black-marble` | HDF5/GeoTIFF metadata, radiance/QA normalisation |
| `ingest-osm` | Streaming PBF feature extraction and semantic mapping |
| `ingest-built` | WSF/GHSL/building/DEM normalization |
| `atlas-fusion` | Observation model, posterior allocation, uncertainty |
| `atlas-validate` | Metrics, reports, stratified holdouts |
| `atlas-cli` | Orchestration only; subcommands delegate to libraries |
| `atlas-wasm` | Pure lookup/decoder surface for the future app |

First code is tests for units, QA sentinels, H3 hierarchy, conservation, and corrupted-file rejection. No downloader yet.

Gate: native and WASM schema/core tests pass with no GDAL/HDF dependency in consumer crates.

## Phase 2 — Black Marble feasibility ingest

Implement one Collection 2 product and a tiny fixture:

1. metadata-driven units/scales;
2. required QA layers;
3. exact footprint areas and `J_DNB`;
4. normalized columnar output;
5. inspection report against provider values.

Gate: golden values and QA states match; no unexplained factor-of-π, `1e4/1e5`, fill-value, or geolocation errors.

## Phase 3 — Radiometry-only baseline

Build selected global city fixtures, then Europe, at native/default H3 resolution with no OSM refinement. Compare SNPP/NOAA/EOG and derive uncertainty strata.

Gate: deterministic Europe build, cross-sensor differences characterised, coverage/quality report approved.

## Phase 4 — Spatial priors and conservative fusion

Implement streaming OSM plus WSF/GHSL completeness features. Start with uniform and simple built-fraction baselines; only then test a learned allocator on whole-city holdouts.

Gate: conservative refinement is exact within quantisation error and improves withheld spatial evidence across multiple continents/OSM-completeness strata.

## Phase 5 — Format experiment

Use real Europe posterior cardinality to compare:

- H3 partition resolutions;
- 16- versus 24-bit log intensity;
- uncertainty codes;
- global versus chunk-local profile IDs;
- zstd/brotli/other browser-compatible compression;
- monolithic index versus range-addressed chunk manifest.

Gate: selected layout meets numerical, file-size, random-access, decode-memory, and WASM targets; specification is frozen as schema v1.

## Phase 6 — Spectral/angular profiles

Implement response-curve forward modelling and unresolved profiles first. Add one or more calibrated enrichment sites with joint spectral/angular evidence. Never deploy generic city profiles by default before transfer tests.

Gate: DNB forward reconstruction and held-out spectral/angular validation pass; uncertainty covers blind-blue cases.

## Phase 7 — Temporal profiles

Implement clock/ephemeris semantics, unresolved fallback, policy schedules, and measured profiles at continuously monitored sites. Inferred regional profiles remain scenarios until validated.

Gate: held-out-night performance beats constant reference where profiles are activated; reference-time normalization is exact.

## Phase 8 — Europe release candidate

Run the complete open-data pipeline twice from a frozen recipe. Produce atlas, provenance, attribution, QA/coverage, compute report, and source-only validation.

Gate: reproducible hashes (or documented deterministic numeric equivalence), licence audit, regression suite, and user review.

## Phase 9 — Propagation integration and end-to-end validation

Define the handoff to the main 3-D solver, implement chunk streaming/tail bounds, and validate at paired ground/atmosphere sites. Keep solver changes outside this project's ingestion crates.

Gate: errors are traceable to source versus propagation components and no fixed town/radius proxy remains.

## Phase 10 — Global production

Estimate costs from Europe measurements, run continent partitions, merge deterministically, validate global strata, publish the open edition, and separately publish any legally permitted enrichment packs.

Gate: global coverage/uncertainty/licence report and repeatable incremental-update procedure.

## Explicitly deferred

- Live/nightly updates.
- Commercial/restricted imagery.
- Machine-learned universal nightly curves.
- Individual-lamp global simulation.
- Direct web-app UI integration.

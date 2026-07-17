# 08. Global processing pipeline

Every stage is a deterministic tile task with immutable inputs, declared outputs, metrics, logs, and a content hash. A stage can be rerun without downloading or recomputing unrelated tiles.

## Stage 0 — Freeze a release recipe

Inputs:

- target `EmissionRelease` and reference year;
- coverage (`europe` proving run or `global` production run);
- exact source product versions and asset queries;
- allowed licence partitions;
- QA thresholds and snow/transient policies;
- model/profile/config revisions;
- spatial chunking and quantisation proposal.

Output: signed/hashed build recipe. No “latest” URLs are permitted after the recipe freezes; resolve them to asset IDs and checksums.

## Stage 1 — Source acquisition and inventory

1. Query official catalogs/APIs.
2. Download with resumable transfers and provider-friendly concurrency.
3. Verify provider checksum where available and compute SHA-256.
4. Save headers, access time, licence snapshot, DOI/citation, query, byte count, and raw asset extent/time.
5. Inventory assets in a content-addressed catalog.

Raw data is read-only. Restricted sources enter separate storage and may not contaminate open-release build graphs.

## Stage 2 — Normalize radiometry

For each Black Marble asset:

1. Read physical scaling/units from metadata, not filename conventions.
2. Extract corrected radiance and all required QA layers.
3. Convert to SI while retaining original values.
4. Record direct versus gap-filled retrieval and latest-good date.
5. Exclude or separately classify clouds, poor quality, aurora, glint, twilight, saturated/censored values, and ephemeral sources according to recipe.
6. Preserve snow/ice as a separate condition rather than blending it into snow-free ordinary emission.
7. Calculate exact pixel surface area on the ellipsoid and integrated `J_DNB`.
8. Emit normalized observation tiles plus QA histograms.

Run SNPP and NOAA-20/21 independently until cross-sensor consistency is measured. Never average first and inspect later.

## Stage 3 — Build the stable reference field

1. Group high-quality observations by source support and reference epoch.
2. Use robust statistics that retain observation count, median/trimmed central estimate, dispersion, and seasonal structure.
3. Detect and classify persistent industrial/offshore sources separately from transient fires/vessels/events.
4. Produce stable annual reference plus optional monthly delta layers.
5. Compare against EOG VNL and explain systematic differences by tile/surface/latitude/brightness class.

The first `EmissionRelease` uses the latest **complete** calendar year shared by the required source products at recipe freeze time. It is not hardcoded in the design.

## Stage 4 — Prepare spatial priors

### OSM

1. Stream a dated planet PBF once; do not query public Overpass for a continental/global build.
2. Filter relevant nodes/ways/relations while preserving tags and relation geometry.
3. Repair/flag invalid polygons deterministically.
4. Map raw tags to versioned source-class features.
5. Rasterise/intersect per processing tile in an equal-area local frame.
6. Calculate completeness features using WSF/GHSL/building-footprint comparison.

### Built surface and terrain

Normalize WSF, GHSL, building footprints, and DEM into independently versioned priors. Do not merge their licences/provenance into an anonymous raster.

## Stage 5 — Learn and validate disaggregation

This stage must precede planet-scale refinement.

1. Select geographically and morphologically stratified training/validation cities.
2. Use calibrated high-resolution nighttime imagery/inventories as fine evidence.
3. Blur/aggregate fine evidence through a sensor/support observation model.
4. Fit non-negative prior weights or a probabilistic allocation model using geometry features.
5. Hold out entire cities/regions, not random neighbouring pixels.
6. Quantify improvement over uniform and built-fraction-only allocation.
7. Reject a model that merely performs well in OSM-rich Europe.

The result is a versioned posterior method with applicability classes and uncertainty, not a universal road-light coefficient.

## Stage 6 — Conservative adaptive refinement

For each baseline observation:

1. Choose target resolution from radiometric support, prior completeness, local spatial complexity, and enrichment evidence.
2. Infer non-negative child shares.
3. Conserve parent `J_DNB` after encoding.
4. Propagate radiometric and allocation uncertainty.
5. Record evidence and posterior method.
6. Enforce parent/descendant exclusivity.

Default target is H3 resolution 8. Resolution 9/10 requires evidence and validation. Low-confidence/sparse areas may remain coarser.

## Stage 7 — Attach spectral, angular, and temporal profiles

1. Match only profiles whose evidence, epoch, region, and source mixture are applicable.
2. Forward-model the DNB response and reject inconsistent profile mixtures.
3. Set unresolved IDs when evidence is absent.
4. Normalise temporal profiles to the source reference phase.
5. Record whether each profile is measured, operational, inferred, scenario, or unresolved.

## Stage 8 — Validate the source atlas

Run internal conservation/round-trip checks, cross-sensor comparisons, spatial holdouts, and inventory comparisons. This gate does not yet use the atmospheric solver except in a separate end-to-end validation suite.

## Stage 9 — Package releases

1. Sort records and build coarse-parent chunks.
2. Quantise only after error experiments.
3. Compress independently with checksums and intensity bounds.
4. Build spatial/temporal layer manifests, profile dictionaries, attribution bundle, and schema descriptor.
5. Decode a sample of every chunk and recheck invariants.
6. Publish open and restricted outputs separately.

## Stage 10 — End-to-end physical validation

Feed the frozen atlas into a frozen propagation solver with measured atmosphere where possible. Compare against calibrated ground all-sky/zenith observations. Attribute residuals using source-rich and atmosphere-rich site metadata rather than tuning the source atlas to compensate for propagation errors.

## Stage 11 — Release and regression archive

Publish:

- atlas files and manifests;
- source citations/attribution/licence notices;
- build recipe and software revision;
- coverage/quality maps;
- validation report and known limitations;
- machine-readable changes from the prior release;
- a small redistributable fixture set.

Retain the prior release and a regression suite so improved inputs do not silently worsen sparse regions or spectral behavior.

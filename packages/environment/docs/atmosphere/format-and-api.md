# Atmospheric format and API

## 1. Release structure

```text
AtmosphereFieldRelease
  manifest
  variable_dictionary
  source_run_manifests
  horizontal_tile_index
  vertical/time chunk index
  compressed field chunks
  climatology/sampling model chunks
  DataValidity/evidence/uncertainty/provenance tables
  attribution and licence partitions
  conformance fixture/report
```

Operational forecast runs are immutable children of an `AtmosphereFieldRelease` with short channel manifests. A channel such as `operational-current` may move; release and run content never does, and a consumer pins the resolved IDs before scientific work begins.

## 2. Query contract

```text
open_atmosphere_release(manifest, dictionaries) -> atmosphere_release_handle
resolve_atmosphere_selection(handle, requested_time_utc, policy)
    -> AtmosphereSelection
plan_atmosphere_query(handle, curved_earth_region, vertical_support,
                      variables, selection, lod) -> ChunkPlan
register_chunk(atmosphere_release_handle, chunk_descriptor, bytes)
query_atmosphere(handle, request) -> AtmosphereStateVolume
sample_climatology(handle, request, climatology_sample_id)
    -> AtmosphereStateVolume
```

`query_atmosphere` operates over a region, not one point, because Physics needs conditions near sources and along paths. It returns contiguous columns/tiles with explicit coordinate transforms and no optical propagation.

## 3. Request fields

- WGS84 geodesic polygon/cap or Physics tile set;
- terrain/ellipsoid altitude range and requested vertical coordinate;
- `requested_time_utc` and time interpolation tolerance;
- required/optional variables and precision/error budget;
- requested/allowed `AtmosphereSelectionMode` values and fallback policy;
- ensemble/central/member/sample request;
- output horizontal/vertical LOD and maximum bytes;
- compatibility requirements for Physics optical model.

## 4. Browser packaging

- Content-addressed chunks, independently compressed and range/tile fetchable.
- Multiresolution horizontal tiles with nested ownership and halos.
- More vertical resolution in the lower atmosphere/boundary layer; no uniform kilometre grid assumption.
- Quantization selected per variable against physical error budgets; preserve `f32` where necessary.
- Masks/evidence/uncertainty compressed separately so absence is never inferred from a zero payload.
- Forecast time/member chunks separable to avoid fetching whole ensembles.
- Optional display tiles are separate from Physics numeric chunks.

PMTiles/Zarr/kerchunk/GRIB are input or delivery candidates, not automatically the normative browser format. The first fixture must benchmark actual byte-range behavior, decode time and Wasm memory.

## 5. Wasm boundary

The Environment atmosphere Wasm decoder validates releases, selects chunks, decodes arrays, transforms vertical coordinates and returns coarse transferable buffers. It may live in the same coordinator worker as Physics but retains its own schema/version. It never performs one JS call per voxel.

## 6. Cache identity

Cache keys include atmosphere release/schema/model, `source_run_id`, `analysis_time_utc`, `valid_time_utc`, `lead_duration`, member or climatology/standard identity, `observation_correction_revision`, `climatology_model_revision`, exact chunks, normalization/interpolation/downscaling revision, requested variables/grid and uncertainty mode. `standard_scenario` products cannot collide with evidence-backed fields.

## 7. Viewer display products

Globe layers may derive `EnvironmentDisplayProduct` surface PM, column AOD, humidity, cloud or confidence tiles. Their manifest names quantity/unit/vertical or column support, `valid_time_utc`, `AtmosphereSelectionMode`, evidence, aggregation and palette hints. Physics never consumes a display product. If an encoding is intended for both uses, it must be declared and validated as the authoritative scientific field product rather than reverse-labelled from its display role.

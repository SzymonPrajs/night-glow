# 11. Compute, storage, and operations

This chapter's scale estimates and annual baseline apply to the **emission domain**. The atmosphere domain shares content-addressed staging/release infrastructure but has a distinct operational cadence and volume model described below.

## Emission scale facts

- The official OpenStreetMap planet PBF listed on 16 July 2026 is about 87 GB compressed.
- Black Marble A2 reports roughly 40 MB per HDF5 tile and 340–648 files per day. A naive whole-world daily archive is therefore on the order of 5–10 TB per year before derived intermediates.
- WSF 2019 is 5,138 global 2°×2° GeoTIFF tiles at 10 m.
- A dense H3 resolution-8 planet would contain about 692 million cells. Sparse/adaptive storage is mandatory.

These figures rule out an initial workflow that downloads every daily global pixel, expands every 10 m prior, and keeps several uncompressed global copies.

## Three build scales

### Feasibility fixture

Four to twelve small areas representing London/UK, continental Europe, sub-Saharan Africa, South/East Asia, North America, coast/offshore, mountains, and a very dark control. Use only legally redistributable tiny fixtures. This validates units, QA, geometry, and source-model assumptions.

### Europe proving build

All Europe, using the global schemas and chunk layout. Use annual/monthly radiometry first; stream continental OSM and only intersect WSF/GHSL tiles touched by radiometric support. This proves scheduling, resumability, output size, and validation before global cost.

### Global production build

Annual stable emission release from annual/monthly products, one dated planet PBF, and on-demand spatial priors. Daily Black Marble is processed globally only if the annual product lacks a required QA/statistic; otherwise daily histories are limited to calibration/temporal study tiles.

## Storage tiers

1. **Raw immutable:** provider files, checksum-addressed, lifecycle-managed; restricted and open sources separated.
2. **Normalized observations:** tiled columnar/cloud-optimised data with only required layers but lossless QA.
3. **Feature/prior cache:** reproducible per-tile geometry summaries; disposable because raw sources plus code can rebuild them.
4. **Posterior work products:** mixed-resolution cell tables and validation predictions.
5. **Release bundle:** compact chunks, dictionaries, manifests, reports.

Never keep accidental full-world uncompressed rasters between stages. A stage declares whether its cache is reproducible and safe to evict.

## Streaming and partitioning

- Stream OSM PBF once through relevant tag filters; avoid database import unless benchmarks prove it necessary.
- Partition tasks by coarse H3 parent with a halo sufficient for raster support/PSF and polygon intersections.
- Assign one owner to the non-halo core so duplicate halo features cannot double count.
- Use bounded memory and external sorting for global records.
- Keep source-native tiling until normalisation; do not mosaic the globe.
- Write atomic temporary outputs, checksum, then rename into the content-addressed cache.

## Resumability

Each task key hashes:

```text
stage + code revision + recipe + input checksums + tile + schema revision
```

A completed task has output checksums and metrics. On restart, valid tasks are skipped. Changed source/config invalidates only downstream dependencies. Cancellation never publishes partial files as complete.

## Parallelism

- Download concurrency respects provider terms and retry headers.
- CPU tile jobs use a bounded work queue; raster decoding and compression have separate limits.
- HDF5/GDAL thread-safety assumptions are isolated and tested.
- Global aggregation uses deterministic merge order to avoid floating-point nondeterminism.
- Memory, scratch disk, and open-file limits are part of the recipe, not workstation folklore.

## Estimate before commitment

The feasibility and Europe runs must measure:

- bytes downloaded and retained per square kilometre / source tile;
- normalized/prior/release compression ratios;
- records by H3 resolution and evidence class;
- CPU seconds and peak RAM per input GB and lit cell;
- cache hit rate and restart cost;
- contribution of OSM, WSF, GHSL, and each enrichment to accuracy and size.

Only then produce a global cost envelope with low/expected/high cases. Do not invent a global runtime now.

## Release cadence

- Annual full baseline.
- Optional quarterly/monthly delta packs where quality supports them.
- Independent enrichment-pack releases.
- Emergency/outage products are outside the stable emission release unless later scoped.

Every release is immutable. A small channel manifest points clients to the recommended release; it never mutates release contents and is resolved to immutable IDs before a scientific scenario is committed.

## Atmospheric operations

Atmospheric products are independent of the annual emission cadence:

| Channel | Typical input | Publication model |
| --- | --- | --- |
| operational forecast | CAMS composition plus meteorological forecast/ensemble | ingest each provider run; validate; publish immutable run; atomically advance a short-lived channel |
| historical/reanalysis | ERA5, EAC4, MERRA-2 and selected observations | periodic immutable partitions by time/source-system version |
| climatology | pinned reanalysis/observations and conditioning recipe | infrequent versioned distributional product |
| standard fixture | public standard atmosphere plus named aerosol/cloud cases | tiny immutable conformance/test release |

Global provider archives remain native/offline inputs. The browser receives only variable-, space-, altitude- and time-subsettable chunks plus small run/channel manifests. Vercel Functions do not fetch, decode or fuse GRIB/netCDF products. An external scheduled worker/job publishes to object storage/CDN, records provider terms and checksums, and never overwrites a run.

Atmospheric capacity experiments measure bytes and CPU per variable-level-time cell, vertical remapping error, regional query bytes, climatology-fit cost, forecast latency, retry/provider outage behavior, and browser decode/interpolation memory. Retention can keep a bounded operational run window while preserving separately archived scientific/reanalysis releases and all manifests required to reproduce published results.

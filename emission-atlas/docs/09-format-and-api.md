# 09. Compact format and lookup API

This is a design contract, not a frozen byte layout. The byte layout is selected only after representative Europe/global cardinality and error experiments.

## Release bundle

```text
atlas-release/
├── manifest.json
├── schema.json
├── dictionaries/
│   ├── spectrum.bin
│   ├── angular.bin
│   ├── temporal.bin
│   ├── elevation.bin
│   └── methods.json
├── layers/
│   ├── baseline/<coarse-h3>.ngla.zst
│   ├── monthly-delta/<month>/<coarse-h3>.ngla.zst
│   └── enrichment/<pack>/<coarse-h3>.ngla.zst
├── index.bin
├── provenance/
└── ATTRIBUTION.md
```

Chunks are independently retrievable, checksummed, decompressible, and decodable. The consumer can fetch only cells within an expanding observer cap or globe viewport.

## Candidate fixed cell payload

Target approximately 24–32 bytes before compression:

| Field | Candidate encoding |
| --- | --- |
| H3 cell | 64-bit index, delta/varint compressed within sorted chunk |
| `J_DNB` | logarithmic 16- or 24-bit positive code, with zero/censored sentinels |
| radiometric uncertainty | compact log-sigma/quantile code |
| allocation uncertainty | compact log-sigma/quantile code |
| spectrum / angular / temporal profile IDs | dictionary IDs, local remapping allowed |
| evidence / quality | bit field plus quality class |
| posterior method / elevation summary | compact IDs |

No value range or quantisation step is accepted until it passes error budgets from rural detection limits through the brightest cores and gas flares. Saturation must be impossible or explicit.

## Manifest fields

- schema and model revisions;
- edition, reference epoch, temporal layer semantics;
- coverage geometry and expected chunks;
- source-manifest hash and build-recipe hash;
- dictionary hashes;
- units and DNB spectral response identifier;
- quantisation definitions and maximum measured error;
- chunk checksums, byte ranges, record counts, H3 resolution histogram;
- total `J_DNB` and uncertainty bounds per chunk for propagation tail bounds;
- licence partition and required attribution;
- software revision and deterministic-build status.

## Lookup semantics

Conceptual API:

```text
query_surface(location, instant, edition, scenario) -> SurfaceEmission
query_cap(center, radius, instant, edition, scenario) -> iterator<SurfaceEmission>
chunk_bounds(cap, edition) -> iterator<ChunkBound>
```

`SurfaceEmission` returns:

- selected finest supported cell and spatial support;
- reference and time-adjusted `J_DNB`;
- optional spectral radiance/intensity with supported wavelength mask;
- optional angular UEF;
- uncertainty components;
- evidence/quality/status;
- provenance handles.

The query never interpolates across missing evidence by default. Optional interpolation/scenario policies are caller-controlled and reported in the result.

## Mixed-resolution selection

The index searches from the finest resolution present in a chunk toward coarser ancestors. Format validation guarantees at most one canonical match. Enrichment packs explicitly supersede baseline cells inside their coverage and must include a replacement mask/version rule; they are not simply added, which would double count.

## Temporal layers

The baseline cell holds the reference intensity and temporal profile. Monthly/temporary layers use one of two declared semantics:

- multiplicative factor relative to the baseline; or
- signed linear-intensity delta with its own uncertainty.

The semantics may not vary within a layer. Negative final emission is clamped only as a reported error; packaging must prevent it.

## WebAssembly compatibility

- Little-endian, versioned, bounded parsing.
- No filesystem assumptions and no native compression dependency unavailable in browsers.
- Independent chunks suitable for HTTP range requests and caching.
- Decoder memory proportional to one/few chunks, not the continent.
- Rust core should compile to native and `wasm32-unknown-unknown`, but ingestion crates may depend on native GDAL/HDF tooling behind separate boundaries.

## Corruption and compatibility

Every chunk has magic, schema version, declared lengths, checksum, and bounded counts. The decoder rejects unknown mandatory fields, non-finite values, invalid H3 indexes, profile IDs outside dictionaries, hierarchical overlap, impossible uncertainty codes, and trailing/short data. Schema migrations are explicit tools; decoders do not guess.

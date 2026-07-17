# `nightglow-data`

Shared schemas and readers for calibrated runtime assets. Raw scientific importers, reprojection, fitting, and global joins belong to the native precompute application; decoding, validation, indexing, and provenance types are shared with Wasm.

## Proposed modules

- `manifest`: immutable product graph, source citations, licenses, transforms, uncertainty, model/schema revisions, and hashes.
- `atmosphere_adapter`: one-way consumer of Environment Atlas `AtmosphereFieldRelease`; preserves run/evidence/vertical/wet-dry/missingness/uncertainty semantics and emits contiguous state volumes.
- `atmosphere_assets`: Physics-owned optical-state and transfer-LUT products derived from an exact atmospheric release and closure revision.
- `celestial`: resolved-star tiles, diffuse spectral tiles, dust/extinction, solar-system coefficients.
- `geospatial`: terrain, horizons, surface BRDF/albedo, atmosphere/weather climatology, emission fields.
- `emission_adapter`: one-way consumer of the independent Environment Atlas emission domain release/schema; preserves `J_DNB`, corrected reference view, profiles/status, exact support, uncertainty, provenance, and licence partition.
- `tile_index`: spatial/sky indices, LOD ranges, byte ranges, and neighbour/border relationships.
- `codec`: endian-stable, alignment-aware, streaming-friendly binary formats.
- `cache`: content-addressed runtime asset cache policy independent of browser storage mechanism.

## Product requirements

Every asset declares physical quantity and units, spectral and spatial support, coordinate reference, epoch/time support, calibration/inversion transform, uncertainty/quality mask, missing-data semantics, source/version/license, schema/model revision, content hash, and dependencies. See [Data and provenance](../../docs/DATA_AND_PROVENANCE.md).

An image file is not a calibrated product merely because it resembles the desired sky. Visualizations may be used as qualitative references only until their numeric mapping and license are verified.

## Environment Atlas rules

`nightglow-data` does not define a competing emission format and does not ingest raw VIIRS/OSM/inventory sources. It either uses released emission schema/format crates or an independently implemented decoder that passes the emission-domain-owned conformance fixture. It exposes a coarse `SurfaceEmissionBatch` to the artificial-light module; any projection to a Physics spectral/angular source happens after schema validation and explicit unresolved-profile policy. See [the consumer contract](../../docs/contracts/EMISSION_RELEASE_CONTRACT.md).

It also does not ingest raw forecast/reanalysis/station/satellite archives or define competing atmospheric state semantics. It consumes release chunks through a conforming decoder and exposes a regional `AtmosphereStateVolume`. State-to-spectral-optics closure remains in `nightglow-physics`; provider-format parsing and global fusion remain in Environment Atlas. See [the umbrella contract](../../docs/contracts/ENVIRONMENT_ATLAS_CONTRACT.md).

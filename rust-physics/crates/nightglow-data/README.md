# `nightglow-data`

Shared schemas and readers for calibrated runtime assets. Raw scientific importers, reprojection, fitting, and global joins belong to the native precompute application; decoding, validation, indexing, and provenance types are shared with Wasm.

## Proposed modules

- `manifest`: immutable product graph, source citations, licenses, transforms, uncertainty, model/schema revisions, and hashes.
- `atmosphere`: vertical-profile and transfer-LUT products.
- `celestial`: resolved-star tiles, diffuse spectral tiles, dust/extinction, solar-system coefficients.
- `geospatial`: terrain, horizons, surface BRDF/albedo, atmosphere/weather climatology, emission fields.
- `emission_adapter`: adapter contract for the existing `emission-atlas/` output.
- `tile_index`: spatial/sky indices, LOD ranges, byte ranges, and neighbour/border relationships.
- `codec`: endian-stable, alignment-aware, streaming-friendly binary formats.
- `cache`: content-addressed runtime asset cache policy independent of browser storage mechanism.

## Product requirements

Every asset declares physical quantity and units, spectral and spatial support, coordinate reference, epoch/time support, calibration/inversion transform, uncertainty/quality mask, missing-data semantics, source/version/license, schema/model revision, content hash, and dependencies. See [Data and provenance](../../docs/DATA_AND_PROVENANCE.md).

An image file is not a calibrated product merely because it resembles the desired sky. Visualizations may be used as qualitative references only until their numeric mapping and license are verified.

# 05. Spatial model

## Decision: sparse mixed-resolution H3

H3 is the proposed global lookup key because it is hierarchical, planet-wide, compact in 64 bits, and has mature Rust support. It avoids latitude-dependent rectangular lookup logic and supports coarse-to-fine chunk discovery.

Official H3 statistics give:

| Resolution | Average cell area | Average edge | Intended use |
| --- | ---: | ---: | --- |
| 6 | 36.13 km² | 3.72 km | release chunk summaries / very sparse areas |
| 7 | 5.16 km² | 1.41 km | coarse stable-dark or low-confidence support |
| 8 | 0.737 km² | 0.531 km | default VIIRS-scale posterior |
| 9 | 0.105 km² | 0.201 km | supported refinement (~100 m scale) |
| 10 | 0.0150 km² | 0.0759 km | strong high-resolution patches only |

H3 cells vary in area, by nearly a factor of two among fine-resolution hexagons. Therefore the atlas stores integrated `J_DNB`, never treats cell values as equal-area totals, and uses exact cell/footprint areas for density conversion. H3 uses a spherical indexing model; physical distances, areas, curvature, and propagation use WGS84/validated geometry rather than H3 averages.

## Why resolution 8 is the baseline

Black Marble's grid spacing is 15 arc seconds and VIIRS DNB native footprint is roughly 742 m. H3 resolution 8 is of the same order. Finer global H3 coverage would imply detail the sensor does not resolve and would explode cell counts: a fully populated resolution-8 planet has about 691.8 million cells. The atlas must be sparse and should store only supported emitting/upper-bound cells plus coarse coverage metadata.

## Conservative refinement

For each coarse observation footprint:

1. Compute exact overlap with candidate child cells/features in an equal-area local projection or robust spherical/ellipsoidal method.
2. Build non-negative prior weights from independent geometry and semantics.
3. Apply a calibrated observation model/PSF rather than assigning all signal to vector lines.
4. Infer child shares with regularisation and uncertainty.
5. Renormalise shares so their encoded `J_DNB` sum equals the parent observation after quantisation.
6. Replace the parent with supported children; omit unsupported dark children only when coverage semantics preserve that distinction.

No parent and descendant may coexist, because that would double count light during integration.

## Geometry-prior hierarchy

The prior should use evidence in descending specificity, but the weights must be learned/validated rather than hardcoded as physical truth:

1. Calibrated high-resolution nighttime pixels.
2. Complete municipal luminaires and emitting-facility inventories.
3. OSM explicit light/lamp/facility attributes.
4. OSM buildings, roads, land use, airports, ports, sports, commercial/industrial features.
5. WSF/GHSL built fraction and building-footprint fallback.
6. Uniform allocation within the measured footprint when no reliable geometry exists.

Sparse OSM regions must not become artificially dark. A geometry-completeness score selects how strongly OSM is trusted relative to WSF/GHSL/uniform support.

## Coastlines, water, and high latitudes

- Collection 2 includes land and water; offshore sources are retained as their own class.
- Coastline overlap uses exact surface area, not cell-centre land/water classification.
- Polar regions have unusual darkness season, viewing, snow, aurora, and stray-light conditions. They may require lower temporal confidence or no baseline for portions of the year.
- International date line and polar indexing tests are mandatory.

## Chunks and neighbourhood retrieval

Release files are partitioned by a coarse H3 parent (candidate resolution 3 or 4) and edition/layer. Each chunk contains sorted mixed-resolution descendants and local references into global/versioned dictionaries. A spatial manifest maps chunks to byte ranges, bounding caps, total intensity bounds, epoch, and checksum.

The future solver requests intersecting chunks for an expanding geodesic cap. The chunk intensity bound supports tail-error termination without reading all records.

## Required spatial experiments

Before finalising H3 resolutions:

- Compare res7/8/9 reconstruction against held-out high-resolution images in dense and sparse cities.
- Quantify boundary artefacts from Black Marble lat/lon pixels to H3.
- Compare H3 with an equal-area raster and S2 only on accuracy, storage, and lookup—not aesthetics.
- Test OSM completeness stratification on at least Europe, sub-Saharan Africa, South Asia, East Asia, North America, and South America.
- Determine whether a learned PSF/support model is stable across view angle, latitude, brightness, and surface type.

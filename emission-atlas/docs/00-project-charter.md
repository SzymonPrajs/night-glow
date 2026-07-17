# 00. Project charter

## Mission

Build a reproducible, global evidence product describing where artificial light is emitted from Earth's surface, how strong the supported emission is, and what is known about its spectrum, upward angular distribution, and variation through the night. The product must be compact enough for regional retrieval and stable enough to serve multiple versions of Night Glow's atmospheric solver.

The atlas is a scientific input, not a decorative night-Earth texture. Every value must retain its physical meaning, reference epoch, evidence class, uncertainty, processing lineage, and licence lineage.

## Primary consumers

1. The offline Night Glow physical solver, which may integrate sources over hundreds of kilometres on a curved Earth and through a three-dimensional atmosphere.
2. A future WebAssembly viewer, which will request only the spatial chunks relevant to an observer or globe viewport.
3. Research and validation tools that compare reconstructed sources against satellite imagery, municipal inventories, and ground sky-brightness observations.

## Product editions

- **Global annual baseline:** one edition per complete calendar year when source availability supports it.
- **Monthly deltas:** optional seasonal/temporary layer; never silently merged into the stable baseline.
- **Regional enrichment packs:** higher-resolution or better-characterised patches for cities, countries, or research sites.
- **Temporal policy packs:** local schedules or measured nightly profiles, separately versioned because they change faster than geometry.

The first operational run should cover Europe because it is large, diverse, and computationally bounded. It must use exactly the same schemas, code paths, quality rules, and tile partitioning as a global build.

## Success criteria

- A query anywhere on Earth returns one of: supported emission, supported dark/upper-bound, or no evidence. It never substitutes a national model merely because the user is located in that country.
- Refining a satellite footprint with roads/buildings conserves its integrated DNB signal within a declared numerical tolerance.
- A city is represented by its measured/refined spatial distribution, not a centroid and radius.
- Unresolved spectrum, angular distribution, or nightly schedule stays machine-readable as unresolved.
- Builds are deterministic from immutable source manifests and can resume by tile.
- Regional additions improve only their support area and do not create seams or double-count parent data.
- The output can be consumed without GDAL, OSM, HDF5, or the raw research archive.
- Validation reports separate source reconstruction error from atmospheric propagation error.

## Non-goals for this project

- Computing sky radiance at the observer.
- Baking in one aerosol model, weather condition, propagation radius, Bortle class, or visual tone map.
- Replacing satellite radiometry with population, road density, or settlement extent.
- Predicting individual lamp states globally.
- Claiming a universal late-night dimming curve from VIIRS.
- Shipping source datasets whose licences prohibit redistribution.
- Integrating directly into the existing web application during the research phase.

## Scientific principles

### Observation before proxy

Calibrated nighttime radiance sets the total supported emission at its native support. Geometry may distribute that total inside the support but may not increase it. An inventory may replace the proxy only when its calibration and completeness are established.

### Preserve the measured quantity

VIIRS DNB reports radiance in a broad panchromatic response. It does not directly report photopic lumens, a visible spectral power distribution, or hemispherically integrated upward flux. Those quantities require additional evidence or assumptions and must not be presented as measurements.

### Unknown is data

Missing, censored, below detection, cloud-contaminated, snow-contaminated, gap-filled, and genuinely dark are different states. The atlas must retain these distinctions.

### Refinement follows evidence

Native global resolution is acceptable where that is all the evidence supports. High-resolution patches are desirable where public calibrated imagery or complete inventories exist. The format must allow both in one atlas.

### Reproducibility over convenience

Every release has immutable configuration, source checksums, software revisions, transformation parameters, tile-level logs, validation results, and a machine-readable attribution bundle.

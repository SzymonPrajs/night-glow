# Data products and provenance

## 1. Data principle

The toolkit consumes calibrated physical quantities, not screenshots. Every runtime product is built from a pinned input manifest and carries enough metadata to answer: what was measured or modelled, in which units/frame/epoch, how it was transformed, what uncertainty/quality applies, what license permits redistribution, and which code/model revision created it.

## 2. Candidate data families

| Domain | Candidate/source class | Intended role | Critical caveat |
|---|---|---|---|
| Stars | Gaia DR3 plus supplementary bright/spectral/variable catalogues | astrometry, photometry, kinematics, LOD | Gaia has quality/completeness/bright-source limits; raw scale is not browser-suitable |
| Milky Way | component-separated calibrated all-sky surveys/maps | unresolved/diffuse spectral radiance | a rendered Gaia colour image is not itself calibrated numeric runtime data |
| Ephemerides | JPL DE440/DE441 or validated derivative | Sun/Moon/planet states | data size, date range, license and interpolation error |
| Time/frames | IERS/EOP + leap seconds + IAU SOFA conventions | apparent place | update/version and offline fallback |
| Night lights | NASA VIIRS Black Marble / EOG-class products + inventories | evidence for emission inversion | at-sensor DNB radiance is not upward source power; contamination and spectral ambiguity |
| Terrain | NASADEM/SRTM or more suitable regional DEM | horizon/occlusion/normals | voids, vertical datum, coverage and resolution |
| Surface | MODIS/VIIRS MCD/VNP43 BRDF/albedo and land/water/snow state | lower-boundary reflection | day-derived kernels and spectral bands need night-model interpretation |
| Weather | ERA5 plus higher-resolution/live sources where licensed | atmosphere/cloud initial state | ERA5 is about 0.25° for downloadable reanalysis subset; local clouds/aerosols need finer/observed data |
| Atmosphere | standard profiles, spectroscopy/optical-property references | molecular/aerosol/cloud coefficients | redistribution rights and band-model validation |
| Observations | calibrated all-sky radiance/photometry campaigns | model validation | camera processing and unknown conditions can invalidate comparisons |

## 3. Star catalogue precompute

Gaia DR3 contains about 1.46 billion sources in its astrometric solution, so the browser product must be selective and hierarchical. Native processing should:

1. ingest source fields and official quality metadata;
2. retain covariance/quality and missing-value semantics;
3. derive or fit spectral coefficients with uncertainty;
4. identify supplementary catalogues for very bright, saturated, variable, binary, or spectrally incomplete sources;
5. partition the sphere into equal-area hierarchical cells;
6. build flux/magnitude/quality tiers with proper-motion padding;
7. store reference epoch and enough kinematics for runtime propagation;
8. generate aggregate flux statistics for fainter/unresolved transitions;
9. validate counts, total flux, colour distributions, and epoch propagation.

Do not ship all sources merely because binary compression makes a large file technically possible. LOD selection is based on visual/physical contribution and completeness, with a separately calibrated diffuse tier.

## 4. Milky Way and diffuse products

Construct separate tiles for resolved-star residual handling, unresolved integrated starlight, dust-scattered Galactic light, line/nebular components, zodiacal light, airglow, and any extragalactic background retained. Each tile includes spectral radiance or basis coefficients, survey PSF/effective angular resolution, sky frame, absolute calibration, uncertainty, mask, and resolved-source subtraction policy.

The official Gaia all-sky colour visualization is valuable as a morphology/colour sanity check and has stated attribution terms, but a display composite should not become the physical map unless the underlying numeric data, mapping, PSF, calibration, and redistribution license are established.

## 5. Artificial emission inversion

Nighttime satellite products measure radiance arriving at a sensor through atmosphere and view geometry. The inferred emission product should represent a physically usable upward quantity, such as spectral radiant intensity by direction or total upward spectral flux plus a normalized angular profile.

The inversion manifest records sensor spectral response, overpass time, lunar illumination, cloud/aerosol/snow screening, surface reflection assumptions, atmospheric correction, saturation, temporal aggregation, source-height/geometry priors, spectral reconstruction, inventory fusion, and uncertainty. Evidence flags from the existing emission atlas should survive the adapter.

## 6. Surface, terrain, and weather

- DEM products retain horizontal/vertical datum and source resolution. Derived horizon tiles record observer-height assumptions, curvature, refraction policy, maximum angular error, and input tile hashes.
- BRDF/albedo products retain bands, kernel model, quality flags, snow state, observation window, and interpolation method. Runtime spectral fitting includes an error estimate.
- Weather products retain analysis/forecast/reanalysis identity, valid time, grid/vertical coordinates, variables, ensemble/uncertainty where available, and downscaling/interpolation. Missing aerosol or cloud microphysics is not inferred as “clear.”

## 7. Product manifest

Conceptual manifest fields:

```yaml
product_id: content-addressed logical identifier
schema_revision: binary/schema compatibility
model_revision: equations and numerical construction revision
quantity: spectral_radiance | flux | brdf_coefficients | elevation | ...
units: explicit machine-readable convention
coordinates: frame, projection, datum, epoch, axis order
support: spatial, angular, spectral, temporal bounds and LOD
sources: URLs/DOIs, versions, access dates, checksums, citations
transforms: ordered calibrated processing steps and parameters
quality: masks, uncertainty, convergence, extrapolation
license: source and derived-product redistribution obligations
dependencies: content hashes
content: encoding, byte ranges, checksum, compression
```

## 8. Reproducibility and publication

- Fetch inputs into a checksummed staging cache.
- Keep credentials and non-redistributable raw data outside published assets.
- Pin toolchain, code revision, configuration, and input checksums.
- Produce into staging; validate; publish atomically.
- Content-address immutable assets and make a small open fixture available for tests.
- Never overwrite an asset under an unchanged URL after physics or calibration changes.
- Generate human-readable attribution/license notices from the same manifest used by code.

## 9. Research sources

Detailed source notes and official links are split by domain under [`research/`](research/README.md). Candidate status is not approval: every dataset still needs scientific, legal, size, update, and redistribution review before adoption.

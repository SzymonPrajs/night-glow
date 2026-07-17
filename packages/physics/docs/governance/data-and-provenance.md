# Data products and provenance

## 1. Data principle

The toolkit consumes calibrated physical quantities, not screenshots. Every runtime product is built from a pinned input manifest and carries enough metadata to answer: what was measured or modelled, in which units/frame/epoch, how it was transformed, which `DataValidity`, evidence and uncertainty apply, what numerical fidelity/convergence applies to computed products, what licence permits redistribution, and which code/model revision created it.

## 2. Candidate data families

| Domain | Candidate/source class | Intended role | Critical caveat |
|---|---|---|---|
| Stars | Gaia DR3 plus supplementary bright/spectral/variable catalogues | astrometry, photometry, kinematics, LOD | Gaia has quality/completeness/bright-source limits; raw scale is not browser-suitable |
| Milky Way | component-separated calibrated all-sky surveys/maps | unresolved/diffuse spectral radiance | a rendered Gaia colour image is not itself calibrated numeric runtime data |
| Ephemerides | JPL DE440/DE441 or validated derivative | Sun/Moon/planet states | data size, date range, license and interpolation error |
| Time/frames | IERS/EOP + leap seconds + IAU SOFA conventions | apparent place | update/version and offline fallback |
| Artificial surface emission | Versioned Environment `EmissionRelease` products built from Black Marble/EOG/inventories/priors | independent source-side input to Physics | `J_DNB` is corrected reference-view DNB directional intensity, not total upward flux or spectrum; profiles may remain unresolved |
| Terrain | NASADEM/SRTM or more suitable regional DEM | Physics-owned `SurfaceTerrainProduct` horizon/occlusion/normals | voids, vertical datum, coverage and resolution |
| Surface | MODIS/VIIRS MCD/VNP43 BRDF/albedo and land/water/snow state | Physics-owned `SurfaceTerrainProduct` lower-boundary reflection | day-derived kernels and spectral bands need night-model interpretation |
| Atmospheric state | Versioned Environment `AtmosphereFieldRelease` products fused from forecasts, reanalyses, measurements and climatology | 4-D meteorology, aerosol, cloud and surface state | preserve `AtmosphereSelectionMode`, canonical run/time/member/sample/scenario IDs, `SourceEvidenceClass`, vertical coordinates, wet/dry convention, `DataValidity`, uncertainty and resolution; coarse state is not exact street-scale weather |
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

Raw nighttime satellite products and inventories are inputs to the independent Environment emission domain project, not to Physics precompute. Environment emission domain owns sensor-path correction, source fusion, conservative H3 refinement, and source-side uncertainty. Its conserved handoff quantity is `J_DNB [W sr^-1]` for a declared DNB response and corrected reference-view convention, plus exact support and tagged resolved/unresolved spectrum, angular, and temporal profiles.

Physics registers an immutable `EmissionRelease` and preserves emission schema/model/release IDs, chunk/dictionary hashes, DNB response/reference view, coverage/censoring, profile states, joint model family, source height/support, uncertainty components, evidence, provenance, licence partition, and attribution. It never creates a second emission schema or collapses no evidence/unresolved into zero/default values.

Projection into the Physics wavelength basis and construction of `ArtificialLightBoundarySource` are downstream calculations with their own revision and error. They require compatible resolved profiles or an explicit named scenario. See [the consumer contract](../contracts/emission-release.md).

## 6. Surface, terrain, and atmospheric state

- DEM products retain horizontal/vertical datum and source resolution. Derived horizon tiles record observer-height assumptions, curvature, refraction policy, maximum angular error, and input tile hashes.
- BRDF/albedo products retain bands, kernel model, quality flags, snow state, observation window, and interpolation method. Runtime spectral fitting includes an error estimate.
- Physics packages the selected terrain/horizon and reflective surface state as a `SurfaceTerrainProduct`. Environment may carry contextual terrain or surface fields needed to reconstruct its releases, but Physics reconciles source height, atmospheric terrain masks and its transfer geometry exactly once under a revisioned policy.
- `AtmosphereFieldRelease` products retain exact release/schema/model/chunk identities; `AtmosphereSelectionMode`; `source_run_id`, canonical analysis/valid/lead/member or climatology/standard identity; `observation_correction_revision`; `climatology_model_revision`; per-field `SourceEvidenceClass`; grid support and vertical coordinates; variables and units; wet/dry optical conventions; `DataValidity`; uncertainty; provenance; and downscaling/interpolation revisions. Missing aerosol or cloud microphysics is not inferred as “clear.”
- Physics queries a regional 3-D volume over time, converts it to spectral optics, and records every closure assumption. PM, AOD or visibility alone is diagnostic rather than a complete scattering state. Provider optical diagnostics are never humidity-adjusted twice.
- Far-future fallback is a sample or quantile from a joint, conditioned climatology preserving correlations between boundary-layer depth, humidity, aerosol, cloud and wind. It is never presented as a forecast or synthesized from independent median variables.
- The detailed source research, product schema and handoff live in the Environment [atmosphere dossier](../../../environment/docs/atmosphere/README.md) and this toolkit's [consumer contract](../contracts/environment.md).

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
data_validity: valid | missing | masked | censored | not_covered
evidence: typed source lineage where applicable
uncertainty: typed components and correlation scope
fidelity: approximation/profile identity for computed products
convergence: residual/tolerance/status for computed products
licence: source and derived-product redistribution obligations
dependencies: content hashes
content: encoding, byte ranges, checksum, compression
```

For Environment-derived products, `dependencies` include the independent emission and atmosphere schema/model/release IDs, exact chunk/dictionary hashes, emission source policy, `AtmosphereSelectionMode`, canonical run/time/member/sample/scenario identity, `observation_correction_revision`, `climatology_model_revision`, interpolation/downscaling and `atmosphere_optics_model_revision`. Physics-derived caches retain the upstream licence/provenance partitions and are not new emission or atmosphere releases.

## 8. Reproducibility and publication

- Fetch inputs into a checksummed staging cache.
- Keep credentials and non-redistributable raw data outside published assets.
- Pin toolchain, code revision, configuration, and input checksums.
- Produce into staging; validate; publish atomically.
- Content-address immutable assets and make a small open fixture available for tests.
- Never overwrite an asset under an unchanged URL after physics or calibration changes.
- Generate human-readable attribution/license notices from the same manifest used by code.

## 9. Research sources

Detailed source notes and official links are split by domain under [`research/`](../research/README.md). Candidate status is not approval: every dataset still needs scientific, legal, size, update, and redistribution review before adoption.

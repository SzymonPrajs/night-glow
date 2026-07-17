# Research: resolved stars and catalogues

## Primary candidate

[Gaia DR3](https://www.cosmos.esa.int/web/gaia/dr3) provides astrometry for about 1.46 billion sources plus broad photometric and astrophysical products. The [Gaia Archive](https://www.cosmos.esa.int/web/gaia-users/archive) and [programmatic-access guidance](https://www.cosmos.esa.int/web/gaia-users/archive/programmatic-access) are the starting points for reproducible extraction.

Gaia is not a ready-to-render star list. Research must account for passband calibration, zero points, astrometric/photometric quality flags, missing radial velocities, duplicated/non-single sources, variability, extinction/astrophysical-parameter quality, bright-source behavior, completeness, and permitted redistribution/attribution of derived subsets.

## Proposed native pipeline

1. Define the scientific query and required official fields/quality filters.
2. Preserve reference epoch, covariance/error, source identifiers, passbands, variability/binary flags, and missing data.
3. Supplement very bright, high-proper-motion, variable, spectrally typed, or otherwise incomplete populations with reviewed catalogues.
4. Convert photometry/astrophysical parameters to a compact spectral basis with fit residual and source-quality class.
5. Build hierarchical equal-area sky tiles. [HEALPix](https://healpix.sourceforge.io/doc/html/intro.htm) is the leading candidate because it is hierarchical, equal-area, and supports multiresolution/spherical operations.
6. Partition magnitude/quality tiers, including proper-motion migration margins over supported time range.
7. Build aggregate statistics for unresolved transition and completeness checks.
8. Emit browser tiles with content hash, catalogue revision, epoch, basis, units, and quality.

## Runtime work

Runtime selects visible tiles/tiers, propagates positions with parallax/proper motion/radial velocity where available, applies observer/frame effects, evaluates top-of-atmosphere spectral flux, and batches stars for transfer/PSF/render. Time changes should not reload the global catalogue.

## LOD and flux consistency

LOD must be based on apparent contribution after estimated extinction/PSF/display sampling, with conservative bright/high-motion inclusion. Switching thresholds must not make total field flux jump. A faint statistical representation can preserve aggregate unresolved light, but it must not duplicate the diffuse Milky Way product.

## Validation questions

- counts and magnitude/colour distributions per cell;
- integrated flux versus direct catalogue query on sample regions;
- propagated coordinates versus Gaia/SOFA test calculations;
- high-proper-motion tile containment over supported dates;
- bright-star completeness and saturation handling;
- variable/binary update policy;
- catalogue/diffuse anti-double-counting under threshold sweeps;
- cold/warm bytes and selection latency by browser tier.

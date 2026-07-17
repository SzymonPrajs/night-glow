# Research: Milky Way and diffuse celestial sky

## Required decomposition

A credible high-resolution Milky Way is not one texture. The research must separate:

- resolved catalogue stars;
- unresolved integrated starlight;
- diffuse Galactic light from dust scattering;
- emission/nebular line and continuum components;
- extinction/dust columns affecting sources behind them;
- zodiacal light;
- airglow (local atmospheric volume emission);
- optional extragalactic background.

These components have different spectra, spatial scales, time dependence, distance assumptions, and source-survey PSFs.

## Gaia all-sky colour map

ESA’s [Gaia early DR3 all-sky colour map](https://sci.esa.int/web/gaia/-/the-colour-of-the-sky-from-gaia-s-early-data-release-3) is constructed from the brightness and colour of roughly 1.8 billion stars and is a valuable visual/morphological reference with stated Creative Commons attribution. It should **not** automatically be shipped as the physical diffuse layer: the project needs numeric radiance calibration, exact mapping/processing, effective PSF, resolved-star inclusion policy, dynamic range, and derived-product license review.

## Research programme

1. Inventory all-sky optical surveys/maps with absolute calibration and redistribution rights.
2. Determine whether spectral radiance can be reconstructed across the runtime bands, not merely display RGB.
3. Characterize survey angular response, masks, saturation, zodiacal/airglow subtraction, dust treatment, and seams.
4. Define a resolved-star subtraction/addition scheme using the chosen Gaia tiers.
5. Choose HEALPix-like tile order, basis coefficients, uncertainty, and mip construction that conserves integrated radiance.
6. Separate static celestial products from time/location-dependent zodiacal and airglow models.
7. Validate Galactic-plane/pole radiance, colours, star counts, and flux across LOD.

## Atmospheric/PSF application

Top-of-atmosphere diffuse radiance still undergoes refraction, extinction, and in-scattering. However, a source map already contains a survey PSF and unresolved structure. The target observation response is not obtained by simply applying the same star sprite blur to every texel. Research must support deconvolution/reconvolution limits or a well-defined effective source PSF per LOD, and prevent high-frequency detail beyond the source data’s real resolution.

## Product proposal

Each component tile stores absolute spectral radiance/basis, sky frame, pixel solid angle, source survey/effective PSF, masks, uncertainty, resolved-source threshold/subtraction revision, calibration transform, and license. A composite RGB preview can be emitted for inspection, but is never the authoritative numeric asset.

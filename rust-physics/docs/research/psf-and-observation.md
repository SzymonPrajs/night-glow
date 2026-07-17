# Research: PSF and observation

## Current parity target

The current repository implements a unit-integral Gaussian seeing PSF, wavelength scaling, and airmass dependence, plus derived Fried parameter/coherence-time diagnostics. The first Rust implementation must reproduce those outputs exactly for fixed fixtures so migration is distinguishable from a model change.

[ESO’s exposure-time documentation](https://www.eso.org/observing/etc/doc/helpsphere.html) provides a practical seeing/wavelength/airmass convention, while ESO’s [observing-conditions guidance](https://www.hq.eso.org/sci/observing/phase2/ObsConditions.html) clarifies that image quality includes more than atmospheric seeing. These are reference conventions, not proof that a Gaussian is a complete PSF.

## Physical components to keep separate

1. Turbulence seeing: Kolmogorov/von Karman spectrum, outer scale, wavelength/zenith dependence, turbulence profile, anisoplanatism.
2. Atmospheric refraction/dispersion: chromatic displacement and elongation, especially near horizon.
3. Diffraction: aperture, wavelength, obstruction, spider, finite bandwidth.
4. Optical aberration: field-dependent instrument/lens response.
5. Sampling: pixel integration, resampling, display/retinal sampling.
6. Motion: tracking, exposure integration, camera/observer movement.
7. Scattering/glare: instrument or intraocular wide wings.
8. Artistic bloom: optional display effect, never labelled physical PSF.

## Candidate models

- Gaussian: fast parity/fallback, inadequate wings.
- Moffat: convenient empirical wings, parameters need physical/observational calibration.
- Kolmogorov/von Karman OTF/PSF: physically tied to turbulence and outer scale.
- Airy/obstructed-aperture diffraction: instrument-specific high-resolution component.
- measured kernel or compact basis: appropriate when calibrated for a specific device/eye.

Wide-sky observation is spatially variant. Near-horizon airmass and differential refraction change quickly; tiled kernels, analytic local evaluation, or low-rank bases should be benchmarked against direct convolution.

## Validation

- unit integral/flux at every wavelength, field point, and truncation radius;
- FWHM and encircled-energy curves;
- wavelength and airmass scaling;
- constant-field invariance and delta-source response;
- no negative ringing unless a declared optical transfer representation permits it;
- point-source versus diffuse-field behavior;
- agreement across direct, FFT/tiled, and GPU implementations;
- angular sampling/convergence and cross-tile energy.

## Performance research

Benchmark analytic star kernels, magnitude/PSF-bin instancing, tiled FFT, separable approximations, mip/needlet diffuse filtering, and GPU fragment passes. The chosen WebGL path can accelerate convolution, but the kernel definitions and reference outputs remain owned by Rust physics.

# Point-spread and observation response

Owns normalized atmospheric seeing and optical/sensor/eye response components, their composition, and spatial/spectral variation.

Inputs: seeing/turbulence profile or parameters, wavelength, zenith angle/airmass, aperture/instrument state, angular sampling and field position. Outputs: unit-integral kernels or compact basis, encircled-energy/FWHM diagnostics, and validity metadata.

The initial parity target is the current TypeScript unit-integral Gaussian with ESO-style seeing scaling. Extensions to investigate: Kolmogorov/von Karman profiles, Moffat fits, diffraction/Airy structure, central obstruction, aberration, differential chromatic refraction, anisoplanatism, tracking/motion, pixel response, and wide-field spatial variation.

Physical PSF, intraocular/instrument glare, and artistic bloom are separate named stages. Flux conservation is mandatory. Point sources and diffuse fields require different sampling/convolution treatment.

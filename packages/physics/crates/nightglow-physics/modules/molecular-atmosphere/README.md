# Molecular atmosphere

Owns conversion of an Environment thermodynamic/composition state volume into wavelength-dependent molecular extinction, scattering, absorption and refractivity. It does not acquire, fuse or downscale weather products.

Inputs: provenance-bearing `AtmosphereStateVolume`; altitude/geopotential/hybrid coordinates; pressure, temperature, humidity and gas composition; wavelength basis; gravity/Earth geometry. Outputs: number densities, refractive index support, Rayleigh coefficients/phase function, absorption coefficients, optical-depth diagnostics and propagated uncertainty.

Research must cover dry/moist refractivity, depolarization, ozone and relevant molecular absorption, standard-atmosphere fallbacks, conservative vertical interpolation, spherical stratification, and uncertainty. Validation includes hydrostatic consistency, missing-state behavior, Beer–Lambert limits, wavelength scaling where applicable, and comparison with a line-by-line/band reference. The input obligations are in the [Environment contract](../../../../docs/contracts/environment.md).

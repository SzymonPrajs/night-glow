# Research: atmospheric radiative transfer

## What must be solved

The target spans direct/transmitted sources, horizon/twilight paths, molecular and aerosol scattering, optically thick clouds, anisotropic phase functions, multiple atmosphere–surface reflections, artificial sources distributed over terrain, and spectral radiance at an observer. No single fast approximation should be assumed valid across all of these regimes.

## Candidate reference path

[libRadtran](https://www.libradtran.org/doc/libRadtran.pdf) is a mature atmospheric radiative-transfer package with multiple solvers and is a strong external comparison candidate. Research tasks:

- define a reproducible input/output adapter for plane-parallel and spherical/pseudo-spherical cases;
- identify solvers appropriate for clear, aerosol, and cloud fixtures;
- align molecular/aerosol/cloud/surface quantities and spectral bands exactly;
- compare radiance, not only irradiance;
- confirm license and CI/distribution strategy;
- keep fixtures small and versioned even if the external solver is not a runtime dependency.

Monte Carlo should be considered as an independent check for complex terrain/broken-cloud geometry, but variance and cost must be reported.

## Candidate interactive path

Bruneton and Neyret’s [precomputed atmospheric scattering](https://onlinelibrary.wiley.com/doi/pdf/10.1111/j.1467-8659.2008.01245.x) demonstrates a compact real-time approach for multiple scattering in a spherical atmosphere. It is important prior art, not a drop-in answer: this project also needs artificial ground sources, real atmosphere/weather, clouds, surface BRDF, spectral calibration, and night/horizon accuracy.

Hosek–Wilkie’s [analytic spectral sky model](https://cgg.mff.cuni.cz/projects/SkylightModelling/HosekWilkie_SkylightModel_SIGGRAPH2012_Preprint_lowres.pdf) is useful as a daylight/solar-sky comparison and possible coarse fallback, but it is not a general night-time radiative-transfer solution.

Research variants:

- precomputed transmittance plus single/multiple-scattering LUTs;
- Fourier azimuth modes for layered media and circular source convolution;
- successive-order operator with progressive stopping;
- discrete-ordinate layer operator and adding/doubling;
- source-specific importance sampling/correction near horizon and bright lobes;
- hybrid 1D atmosphere plus terrain/horizontal correction.

## Selection experiments

Build the same small matrix in each credible method: optical depth from vacuum to cloud, Rayleigh-only, multiple aerosol phase functions, Lambertian albedo sweep, low/high source altitude, zenith/horizon directions, Sun/Moon collimated sources, and localized upward artificial source.

Compare absolute/relative radiance, integrated energy, angular features, residual with scattering order, memory, precompute time, runtime source update, interpolation error, and cancellation granularity. Choose separate reference and interactive algorithms if necessary, while retaining one model contract and parity fixtures.

## Key risks

- a LUT optimized for daylight may lose accuracy at extremely low radiance and long horizon paths;
- sharp aerosol/cloud forward peaks may alias angular grids;
- atmosphere/surface feedback may be accidentally counted twice;
- a horizontally homogeneous transfer operator may be invalid for real clouds/terrain;
- RGB coefficients can conceal spectral errors from line emitters;
- “more scattering orders” without a residual can still be unconverged.

# Radiative transfer

Owns propagation of compatible spectral source terms through atmosphere and surface boundaries, including extinction, in-scattering, multiple scattering, and repeated surface coupling.

Inputs: spatially varying `OpticalAtmosphereState`, spherical/oblate and refracted geometry/ray paths, surface response, source boundary fields, spectral/angular grids, solver tolerance and domain-error bound. Outputs: spectral radiance at the observer plus per-source/order/residual/domain-truncation diagnostics.

Candidate reference methods include discrete ordinates, successive orders, Monte Carlo, and established external codes. Candidate interactive methods include precomputed scattering/transfer operators and adaptive source evaluation. Selection must be based on accuracy, anisotropic phase-function behavior, spherical/horizon performance, memory, and separability—not shader convenience.

Linearity permits solar, lunar, stellar, diffuse, and artificial source contributions to share a transfer operator only while the exact atmosphere/surface state is fixed. The domain covers polluted source air, intermediate plumes/cloud and observer air rather than one local column. Conservation, reciprocity where applicable, positivity, optically thin/vacuum limits, curved-Earth/domain convergence, and scattering-order convergence are mandatory tests.

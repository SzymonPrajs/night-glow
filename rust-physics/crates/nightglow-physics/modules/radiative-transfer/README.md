# Radiative transfer

Owns propagation of compatible spectral source terms through atmosphere and surface boundaries, including extinction, in-scattering, multiple scattering, and repeated surface coupling.

Inputs: optical layers, geometry/ray paths, surface response, source boundary fields, spectral/angular grids, solver tolerance. Outputs: spectral radiance at the observer plus per-source/order/residual diagnostics.

Candidate reference methods include discrete ordinates, successive orders, Monte Carlo, and established external codes. Candidate interactive methods include precomputed scattering/transfer operators and adaptive source evaluation. Selection must be based on accuracy, anisotropic phase-function behavior, spherical/horizon performance, memory, and separability—not shader convenience.

Linearity permits solar, lunar, stellar, diffuse, and artificial source contributions to share a transfer operator only while optical/surface state is fixed. Conservation, reciprocity where applicable, positivity, optically thin/vacuum limits, and scattering-order convergence are mandatory tests.

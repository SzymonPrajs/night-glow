# `nightglow-validation`

Scientific and numerical evidence for the toolkit. Validation is not limited to unit tests and screenshots.

The current executable independently decodes the language-neutral Environment
fixtures, resolves the complete scenario and terrain/data manifests, publishes
the coherent product, compares all 24 `f32` values with the contract fixture,
and reports convergence against the analytic exponential column. JPL vector and
browser evidence remain in the reference-viewer/tooling harness.

## Proposed modules

- `analytic`: vacuum, optically thin, symmetric, Lambertian, inverse-square, and known-integral cases.
- `reference_rt`: adapters and fixtures for libRadtran or another accepted transfer solver.
- `astrometry`: SOFA/JPL reference vectors, time-scale, frame, and proper-motion cases.
- `photometry`: standard passband, colour, magnitude/flux, and spectral-integration cases.
- `convergence`: parameter sweeps over grids, bands, quadrature, scattering orders, and precision.
- `conservation`: energy/flux, positivity, normalization, reciprocity, and rotation tests.
- `observations`: calibrated all-sky datasets and comparable condition manifests.
- `parity`: native/Wasm/reference-profile comparisons.
- `report`: machine-readable results plus reviewable plots/tables.

Every golden output records the exact model/data revisions that created it. A golden image cannot override a failed physical invariant. See [Validation plan](../../docs/governance/validation-plan.md).

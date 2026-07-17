# `nightglow-solver`

The orchestrator for physical state. It converts a scenario and available assets into progressively refined spectral-radiance products while keeping the UI responsive.

## Proposed modules

- `scenario`: immutable normalized input and revision generation.
- `graph`: typed computation nodes and dependency declarations.
- `planner`: fidelity selection, tile selection, cost/error estimates, and job priority.
- `executor`: native parallel or Wasm-worker execution backends.
- `cache`: completed-result caches with dependency hashes.
- `refinement`: residual-driven LOD/scattering/angular/spectral refinement.
- `cancellation`: revision tokens and bounded cooperative checkpoints.
- `assembly`: compatible-basis radiance sum and output product construction.
- `diagnostics`: timings, memory, residuals, extrapolation, and quality reporting.

## Prohibitions

No new scattering law, photometric conversion, coordinate transform, or PSF formula may be written here. The solver can choose an implementation declared by a domain module, but cannot become an unreviewable second physics layer.

The authoritative order and cache model are in [Computation DAG](../../COMPUTATION_DAG.md).

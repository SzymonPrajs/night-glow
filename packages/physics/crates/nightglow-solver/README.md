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

For artificial light, the planner asks `EmissionFieldProvider` for emission chunks and source-side intensity bounds, then asks `AtmosphereFieldProvider` for the regional four-dimensional state needed by the conservatively bounded curved-Earth transfer domain. It does not select a fixed source radius or sample weather only at the observer. Cache identities include both independent releases/chunks, source policy, atmospheric run/evidence/sample, interpolation and optical closure separately from the Physics model revision.

## Prohibitions

No new scattering law, photometric conversion, coordinate transform, or PSF formula may be written here. The solver can choose an implementation declared by a domain module, but cannot become an unreviewable second physics layer.

The authoritative order and cache model are in [Computation DAG](../../docs/architecture/computation-dag.md).

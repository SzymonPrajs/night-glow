# Native precompute application

This future Rust CLI performs expensive, global, deterministic work that does not belong in a browser.

## Responsibilities

- ingest pinned raw sources into a local staging cache;
- validate units, checksums, coverage, quality fields, licenses, and epochs;
- convert coordinate systems and spectral bases;
- build atmosphere/surface transfer LUTs with convergence evidence;
- propagate/filter Gaia and supplementary catalogues into flux-complete sky LODs;
- construct calibrated diffuse-celestial products without double-counting resolved stars;
- build terrain/horizon and surface BRDF products;
- adapt the emission atlas into propagation-ready source tiles;
- emit immutable content-addressed runtime assets and a full provenance report.

## Proposed commands

```text
nightglow-precompute inspect <input-manifest>
nightglow-precompute build <product> --manifest <input-manifest>
nightglow-precompute validate <output-manifest>
nightglow-precompute report <output-manifest>
```

The exact CLI is a design placeholder. Network downloading should be a separately auditable step or explicit subcommand, never an invisible side effect of a scientific build.

## Publication rule

Outputs are written to a temporary/staging location, validated, then atomically published. Interrupted or cancelled work must never look like a complete tile or LUT. A second clean build from the same inputs/configuration must produce identical scientific content hashes.

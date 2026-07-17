# Native precompute application

This Rust CLI is the native orchestration boundary for expensive, global,
deterministic work that does not belong in a browser. Its first bounded command
is implemented:

```sh
cargo run --manifest-path packages/physics/Cargo.toml \
  -p nightglow-precompute -- fixture-report
```

It decodes the committed Physics assets, consumes the independent Environment
contract products through the Physics adapter, runs the shared solver, and emits
a deterministic JSON summary. It performs no network access, provider ingest,
global precompute, or production publication.

## Responsibilities

- ingest only pinned Physics-owned raw catalogues/reference sources into a local staging cache;
- consume Environment products through their release contracts, never their raw provider archives;
- validate units, checksums, coverage, `DataValidity`, evidence, uncertainty, licences, and epochs;
- convert coordinate systems and spectral bases;
- build atmosphere/surface transfer LUTs with convergence evidence;
- propagate/filter Gaia and supplementary catalogues into flux-complete sky LODs;
- construct calibrated diffuse-celestial products without double-counting resolved stars;
- build terrain/horizon and surface BRDF products;
- consume frozen Environment emission and atmosphere releases plus conformance fixtures without repeating their raw-data inference, forecast ingestion or fusion;
- optionally build Physics-specific source-projection and atmosphere-optics/transfer accelerators keyed by the independent releases, canonical selection/run/time/sample/scenario identities, interpolation/downscaling, atmospheric-optics, spectral-projection, geometry and Physics model revisions;
- emit immutable content-addressed runtime assets and a full provenance report.

## Future commands

```text
nightglow-precompute inspect <input-manifest>
nightglow-precompute build <product> --manifest <input-manifest>
nightglow-precompute validate <output-manifest>
nightglow-precompute report <output-manifest>
```

Network downloading remains a separately auditable future step or explicit
subcommand, never an invisible side effect of a scientific build.

## Publication rule

Outputs are written to a temporary/staging location, validated, then atomically published. Interrupted or cancelled work must never look like a complete tile or LUT. A second clean build from the same inputs/configuration must produce identical scientific content hashes.

Physics-specific accelerators are downstream caches, not new Environment releases. They retain both upstream provenance/licence partitions and may not embed restricted products into an incompatible release.

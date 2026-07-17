# Native precompute applications

This directory will contain thin deterministic CLIs over the shared Rust crates.
The planned applications are independent pipelines:

- `emission-build`: ingest, normalize, infer, validate and publish an
  `EmissionRelease`;
- `atmosphere-build`: ingest model/station/satellite products, normalize vertical
  state, fuse evidence, build climatology and publish an `AtmosphereFieldRelease`;
- `display-build`: derive domain-specific globe tiles from one scientific release;
- `release-set`: validate and record an optional compatible pair without merging it;
- `fixture-build`: create small open native/Wasm/Physics/Viewer conformance cases.

Heavy GRIB/netCDF/Zarr ingestion, global regridding, assimilation-like fusion and
climatology fitting are native/offline jobs. A CLI owns orchestration only; all
scientific transforms live in the canonical packages listed in
[`../../crates/README.md`](../../crates/README.md) and emit revisioned parameters,
validity/evidence/uncertainty and convergence reports, provenance, licences and content hashes. Publication is atomic
and only follows validation.

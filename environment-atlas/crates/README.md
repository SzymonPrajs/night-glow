# Planned Rust crates

No crates exist during the design phase. Shared infrastructure and the two independent domain families are described in [the environment architecture](../docs/20-environment-architecture.md). Emission implementation gates remain in [the emission roadmap](../docs/12-implementation-roadmap.md); atmosphere gates are in [the atmospheric roadmap](../docs/atmosphere/07-roadmap-and-todo.md).

The intended boundary is shared units/provenance/manifest infrastructure, not shared scientific records. Emission and atmospheric releases must remain independently buildable, versioned, testable and consumable.

## Canonical planned packages

These names are authoritative for subsequent scaffolding:

| Package | Responsibility |
| --- | --- |
| `environment-core` | shared units, coordinates/time identifiers, `DataValidity`, provenance/licences, uncertainty primitives and hashes; no domain models |
| `environment-manifest` | optional `EnvironmentReleaseSet` compatibility/provenance manifests only |
| `emission-schema` | `EmissionRelease`, cell/profile/evidence records and schema validation |
| `emission-core` | H3 hierarchy, exact-support queries, conservative refinement and profile semantics |
| `emission-ingest-black-marble` | native Black Marble/EOG radiometry and QA adapters |
| `emission-ingest-osm` | native streaming OSM semantic extraction |
| `emission-ingest-built` | native WSF/GHSL/building/DEM prior adapters |
| `emission-fusion` | source observation model, posterior allocation and uncertainty |
| `emission-format` | immutable emission chunks/dictionaries and native/Wasm decoder |
| `emission-validation` | emission fixtures, conservation, holdouts and release reports |
| `atmosphere-schema` | `AtmosphereFieldRelease`, run/selection/evidence/vertical records and schema validation |
| `atmosphere-ingest` | native provider adapters for model, station, satellite and lidar archives |
| `atmosphere-normalize` | units, grids, vertical coordinates, QA and conservative remapping |
| `atmosphere-fusion` | backbone selection, observation correction, downscaling and uncertainty |
| `atmosphere-climatology` | joint conditioned distributions and reproducible samples |
| `atmosphere-format` | immutable atmosphere chunks/dictionaries and native/Wasm decoder |
| `atmosphere-validation` | state/profile/forecast/climatology fixtures, holdouts and release reports |
| `environment-conformance` | cross-domain release-set checks and end-to-end handoff fixtures; no scientific fusion |

The thin binary package under `apps/precompute/` is `environment-precompute`; the
thin browser binding under `bindings/wasm/` is `environment-wasm`. Neither owns
scientific equations.

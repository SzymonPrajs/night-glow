# Night Glow Environment — design workspace

This folder is the documentation-first Rust data-reconstruction project for Night Glow. It produces compact, versioned environmental fields that Physics can query without downloading or parsing raw global scientific archives in the browser.

It has two expert domains that share infrastructure but retain separate science and releases:

1. **Surface illumination** reconstructs where artificial light leaves Earth's surface, its supported DNB intensity, spectrum/angle/time profiles, uncertainty and provenance.
2. **Atmospheric state** reconstructs the four-dimensional meteorology, aerosol, pollutant and cloud fields through which light propagates.

Environment does **not** propagate light. The independent [Physics](../physics/README.md) package converts atmospheric state into wavelength-dependent optical properties and performs curved-Earth radiative transfer. The independent [Viewer](../../apps/viewer/README.md) displays source and atmospheric layers and renders Physics outputs.

## Current phase

The first synthetic contract slice is implemented in Rust. Independent emission
and atmosphere schemas decode immutable language-neutral fixtures, regional
queries return contiguous batches, Physics can consume those products without
importing Environment crates, and a thin Wasm adapter validates field-sized
buffers. `environment-conformance` executes the release/query boundary, and the
thin `environment-precompute fixture-report` command deterministically
orchestrates the two extracted synthetic adapters without moving their science
into the CLI.

This does not claim provider or scientific-product readiness. Black Marble and
model-atmosphere ingestion, fusion, uncertainty calibration, real-data licence
evidence, global partitioning, and production publication remain gated by the
bounded feasibility work.

The cross-domain checkpoint, exact measurements and remaining gates are summarized
in the repository [implementation status](../../implementation/STATUS.md).

The final package name is `packages/environment/`. This does not turn one emission schema into a catch-all record: `EmissionRelease` and `AtmosphereFieldRelease` are separate products with independent model revisions, temporal behavior, spatial representations, and validation.

## Start here

Begin with the repository-wide [unified system contract](../contracts/README.md). It is authoritative for names, evidence/selection vocabulary, scenario fields, revision identities and cross-project lifecycle; the documents below remain authoritative for Environment science and products.

### Shared architecture

| Document | Purpose |
| --- | --- |
| [Project charter](docs/architecture/charter.md) | Overall mission, products and non-goals |
| [System boundary](docs/architecture/system-boundary.md) | Environment reconstruction versus Physics propagation |
| [Environment architecture](docs/architecture/workspace.md) | Shared Rust crates, domain isolation and release set |
| [Decision: final package name](docs/decisions/0003-environment.md) | Why weather belongs here and why the package is named Environment |

### Surface illumination domain

The emission folder is the authoritative surface-illumination research set. Begin with the [emission findings](docs/emission/research-findings.md), [source catalogue](docs/emission/data-source-catalog.md), [physical data model](docs/emission/physical-data-model.md), [global pipeline](docs/emission/global-pipeline.md), [Physics handoff](docs/emission/physics-handoff.md), and [Viewer handoff](docs/emission/viewer-handoff.md).

### Atmospheric-state domain

| Document | Purpose |
| --- | --- |
| [Atmosphere index](docs/atmosphere/README.md) | Scope and reading order |
| [Charter and boundary](docs/atmosphere/charter-and-boundary.md) | What the domain reconstructs and does not calculate |
| [Research findings](docs/atmosphere/research-findings.md) | Main conclusions and architecture consequences |
| [Source catalogue](docs/atmosphere/source-catalog.md) | Forecast, reanalysis, satellite, lidar, station and climatology sources |
| [4-D field model](docs/atmosphere/field-model.md) | Variables, grids, time, vertical coordinates, evidence, validity and uncertainty |
| [Fusion and fallback](docs/atmosphere/fusion-climatology-and-fallbacks.md) | Reconstruction order, urban priors and far-future policy |
| [Format and API](docs/atmosphere/format-and-api.md) | Native/Wasm runtime product and query contract |
| [Validation, licensing and risks](docs/atmosphere/validation-licensing-and-risks.md) | Acceptance gates and legal partitions |
| [Roadmap and TODO](docs/atmosphere/roadmap-and-todo.md) | Gated research and implementation plan |
| [Atmosphere → Physics handoff](docs/atmosphere/physics-handoff.md) | Normative independent consumer boundary |

## Settled direction

- Use global assimilated models as the continuous 4-D backbone; observations constrain and validate them but cannot alone fill the planet.
- Use ERA5 for historical meteorology, CAMS for composition/optical diagnostics and current forecasts, and MERRA-2 as an independent aerosol reanalysis cross-check.
- Preserve model-level vertical structure near the boundary layer when available. Surface PM or column AOD alone cannot describe a light path through a city plume.
- Preserve the exact per-field `SourceEvidenceClass` values and keep them separate from the one runtime `AtmosphereSelectionMode`; neither is inferred from the other.
- Beyond the useful forecast horizon, return a location/season/local-time distribution with quantiles and sampled scenario identity—not a fabricated deterministic forecast.
- Never apply a universal “city aerosol multiplier.” Urban, traffic, industrial, dust, smoke and marine regimes are learned from open inventories/model climatology and validated stations, with uncertainty and caps.
- Preserve humidity and aerosol composition together because hygroscopic growth can substantially change scattering.
- Keep source emission and atmospheric state separable in storage and revisions so either can change without rebuilding the other.
- Physics owns conversion into spectral extinction, scattering, single-scattering albedo, phase functions, cloud optics and all propagation.
- The Viewer may display atmospheric fields directly, but display tiles are derived products and never Physics inputs.

## Reserved project layout

```text
packages/environment/
├── Cargo.toml
├── apps/precompute/               native ingest, fusion and release tools
├── bindings/wasm/                 thin release decoders and query adapters
├── config/                        pinned domain build recipes
├── crates/
│   ├── environment-core/          units, coordinates, time, provenance, uncertainty
│   ├── environment-manifest/      multi-product release-set metadata only
│   ├── emission-*/                schema/core/ingest/fusion/format/validation
│   ├── atmosphere-*/              schema/ingest/normalize/fusion/climatology/format/validation
│   └── environment-conformance/   cross-domain fixtures only
├── docs/
│   ├── architecture/              package-wide charter and boundaries
│   ├── emission/                  surface-illumination science and delivery
│   ├── atmosphere/                4-D environmental-state science and delivery
│   ├── governance/                licensing, risks, bibliography, open questions
│   └── decisions/                 architecture decision records
├── research/                      bounded dataset probes and evidence reports
└── schemas/                       domain-specific schemas beyond the shared first-slice contracts
```

The next atmospheric data task is not a global download. It is a small
Warsaw/Delhi/rural/marine probe comparing ERA5, CAMS and MERRA-2 variables,
coordinates, licences, vertical interpolation and browser-sized encoding.

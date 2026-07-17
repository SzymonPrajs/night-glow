# Night Glow Environment Atlas

This folder is the documentation-first Rust data-reconstruction project for Night Glow. It produces compact, versioned environmental fields that Physics can query without downloading or parsing raw global scientific archives in the browser.

It has two expert domains that share infrastructure but retain separate science and releases:

1. **Surface illumination** reconstructs where artificial light leaves Earth's surface, its supported DNB intensity, spectrum/angle/time profiles, uncertainty and provenance.
2. **Atmospheric state** reconstructs the four-dimensional meteorology, aerosol, pollutant and cloud fields through which light propagates.

The Environment Atlas does **not** propagate light. The independent [`../physics`](../physics/README.md) project converts atmospheric state into wavelength-dependent optical properties and performs curved-Earth radiative transfer. The independent [`../viewer`](../viewer/README.md) project displays source and atmospheric layers and renders Physics outputs.

## Current phase

**Research and design only. No Rust implementation exists yet.** `Cargo.toml` remains an empty workspace until the domain schemas, source licences, fusion rules, conformance fixtures and ownership boundaries have been reviewed.

Renaming `emission-atlas/` to `environment-atlas/` does not turn one emission schema into a catch-all record. `EmissionRelease` and `AtmosphereFieldRelease` are separate products with independent model revisions, temporal behavior, spatial representations and validation.

## Start here

Begin with the repository-wide [unified system contract](../docs/system-contract.md). It is authoritative for names, evidence/selection vocabulary, scenario fields, revision identities and cross-project lifecycle; the documents below remain authoritative for Environment Atlas science and products.

### Shared architecture

| Document | Purpose |
| --- | --- |
| [Project charter](docs/00-project-charter.md) | Overall mission, products and non-goals |
| [System boundary](docs/02-system-boundary.md) | Environment reconstruction versus Physics propagation |
| [Environment architecture](docs/20-environment-architecture.md) | Shared Rust crates, domain isolation and release set |
| [Decision: broaden and rename](docs/decisions/0003-environment-atlas.md) | Why weather belongs here without merging its science with emission |

### Surface illumination domain

The existing numbered documents `01`–`19` remain the authoritative emission research set. Begin with the [emission findings](docs/01-research-findings.md), [source catalogue](docs/03-data-source-catalog.md), [physical data model](docs/04-physical-data-model.md), [global pipeline](docs/08-global-pipeline.md), [Physics handoff](docs/18-physics-handoff.md), and [Viewer handoff](docs/19-viewer-handoff.md).

### Atmospheric-state domain

| Document | Purpose |
| --- | --- |
| [Atmosphere index](docs/atmosphere/README.md) | Scope and reading order |
| [Charter and boundary](docs/atmosphere/00-charter-and-boundary.md) | What the domain reconstructs and does not calculate |
| [Research findings](docs/atmosphere/01-research-findings.md) | Main conclusions and architecture consequences |
| [Source catalogue](docs/atmosphere/02-source-catalog.md) | Forecast, reanalysis, satellite, lidar, station and climatology sources |
| [4-D field model](docs/atmosphere/03-field-model.md) | Variables, grids, time, vertical coordinates, evidence, validity and uncertainty |
| [Fusion and fallback](docs/atmosphere/04-fusion-climatology-and-fallbacks.md) | Reconstruction order, urban priors and far-future policy |
| [Format and API](docs/atmosphere/05-format-and-api.md) | Native/Wasm runtime product and query contract |
| [Validation, licensing and risks](docs/atmosphere/06-validation-licensing-and-risks.md) | Acceptance gates and legal partitions |
| [Roadmap and TODO](docs/atmosphere/07-roadmap-and-todo.md) | Gated research and implementation plan |
| [Atmosphere → Physics handoff](docs/21-atmosphere-physics-handoff.md) | Normative independent consumer boundary |

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
environment-atlas/
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
├── research/                      bounded dataset probes and evidence reports
└── schemas/                       future normative machine-readable contracts
```

The first atmospheric task is not a global download. It is a small Warsaw/Delhi/rural/marine fixture comparing ERA5, CAMS and MERRA-2 variables, coordinates, licences, vertical interpolation and browser-sized encoding.

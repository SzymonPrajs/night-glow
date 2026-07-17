# Night Glow Global Emission Atlas

This folder is a standalone research and preprocessing project for Night Glow. Its job is to turn heterogeneous public observations of artificial light at night into a compact, global, uncertainty-aware **surface emission atlas**. It does not calculate skyglow and it does not treat towns as ellipses.

The atlas will later feed the main application's curved-Earth, three-dimensional atmospheric solver. Keeping source reconstruction separate from propagation lets the same emission evidence be evaluated under different aerosols, clouds, terrain, observer heights, wavelengths, and times of night without reprocessing the planet.

## Current phase

**Research and design only. No Rust implementation exists yet.** `Cargo.toml` is an intentionally empty workspace. The `crates/`, `schemas/`, and `config/` directories reserve the planned boundaries without pre-empting design decisions.

The phase is complete only when the documentation answers:

1. Which public datasets can legally and technically form a global baseline?
2. What physical quantity can each dataset actually support?
3. How can higher-resolution geometry refine a coarse radiance observation without inventing light?
4. How are spectrum, upward angle, time of night, quality, and uncertainty represented when known and when unknown?
5. What exact processing order, validation gates, compute budget, and output contract should the Rust implementation follow?

## Documentation map

| Document | Purpose |
| --- | --- |
| [00-project-charter.md](docs/00-project-charter.md) | Scope, users, success criteria, and non-goals |
| [01-research-findings.md](docs/01-research-findings.md) | Conclusions and their consequences |
| [02-system-boundary.md](docs/02-system-boundary.md) | Boundary between source atlas and 3-D propagation |
| [03-data-source-catalog.md](docs/03-data-source-catalog.md) | Global, regional, and validation datasets |
| [04-physical-data-model.md](docs/04-physical-data-model.md) | Quantities, units, profiles, uncertainty, and invariants |
| [05-spatial-model.md](docs/05-spatial-model.md) | H3 hierarchy, adaptive resolution, and conservative refinement |
| [06-temporal-model.md](docs/06-temporal-model.md) | Time-of-night, seasonal, and policy schedules |
| [07-spectral-angular-model.md](docs/07-spectral-angular-model.md) | Spectrum and upward emission functions |
| [08-global-pipeline.md](docs/08-global-pipeline.md) | Reproducible end-to-end processing stages |
| [09-format-and-api.md](docs/09-format-and-api.md) | Compact files and consumer-facing lookup contract |
| [10-validation.md](docs/10-validation.md) | Calibration, holdouts, metrics, and acceptance gates |
| [11-compute-and-operations.md](docs/11-compute-and-operations.md) | Global/Europe builds, storage, resumability, and releases |
| [12-implementation-roadmap.md](docs/12-implementation-roadmap.md) | Ordered Rust build plan with stop/go gates |
| [13-licensing-and-provenance.md](docs/13-licensing-and-provenance.md) | Licence isolation, attribution, manifests, and redistribution |
| [14-open-questions.md](docs/14-open-questions.md) | Unresolved decisions and required experiments |
| [15-bibliography.md](docs/15-bibliography.md) | Primary sources and access points |
| [16-first-feasibility-experiment.md](docs/16-first-feasibility-experiment.md) | Exact first research/engineering experiment after review |
| [17-risk-register.md](docs/17-risk-register.md) | Scientific, product, legal, and operational failure modes |

## Settled direction

- Global design from the first version; Europe is a bounded proving run, not a separate architecture.
- NASA Black Marble Collection 2 is the preferred global radiometric backbone; EOG VIIRS is a comparison/fallback product.
- OSM, WSF, GHSL, and building footprints are spatial evidence, never independent brightness measurements.
- A mixed-resolution sparse H3 atlas stores only supported emission. Dark, missing, and unknown are distinct states.
- The conserved baseline quantity is DNB-band directional radiant intensity integrated over surface area, not guessed total lumens or total upward watts.
- Spectrum, upward angular distribution, and time-of-night behavior use shared profile dictionaries with explicit unresolved profiles.
- No propagation radius is baked into the atlas. The future solver chooses its source domain adaptively; 100–150 km is an optimisation hypothesis, not a physical cutoff.

## Reserved project layout

```text
emission-atlas/
├── Cargo.toml                 # empty design-phase workspace
├── config/                    # future versioned build recipes
├── crates/                    # future Rust workspace members
├── docs/                      # authoritative design
├── research/                  # future dataset probes and experiment reports
└── schemas/                   # future normative machine-readable schemas
```

The first implementation task is deliberately not “download the planet.” It is the small radiance-units/QA feasibility experiment specified in the roadmap.

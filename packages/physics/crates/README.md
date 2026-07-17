# Proposed shared crates

This directory records crate boundaries before any Cargo manifests or Rust sources are created.

| Crate | Question it answers |
|---|---|
| [`nightglow-core`](nightglow-core/README.md) | What are the shared quantities, grids, spectra, frames, IDs, and errors? |
| [`nightglow-physics`](nightglow-physics/README.md) | What equations describe each physical phenomenon? |
| [`nightglow-astronomy`](nightglow-astronomy/README.md) | Where are celestial sources and how do they move/appear? |
| [`nightglow-data`](nightglow-data/README.md) | How are calibrated, versioned assets represented and read? |
| [`nightglow-solver`](nightglow-solver/README.md) | In what order are calculations scheduled, refined, cached, and cancelled? |
| [`nightglow-validation`](nightglow-validation/README.md) | How do we know calculations are correct and converged? |

The future dependency graph and ownership rules are in [Architecture](../docs/architecture/overview.md).

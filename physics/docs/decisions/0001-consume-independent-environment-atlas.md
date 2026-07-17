# ADR 0001: Consume Environment Atlas emission domain as an independent product

- Status: accepted
- Date: 2026-07-17

## Context

Environment Atlas emission domain and Physics are separate expert projects. Atlas reconstructs source-side artificial emission from heterogeneous observations. Physics propagates source boundary conditions through terrain, atmosphere, surface coupling, observation, and rendering. Merging their workspaces or duplicating inference would couple release cycles, invite double correction, and make errors difficult to attribute.

The atlas's defensible baseline is `J_DNB [W sr^-1]`, a DNB-response directional intensity integrated over exact surface support for a declared corrected reference view. Spectrum, upward angle, and time can remain unresolved. Earlier Physics wording expected generic spectral intensity or total flux and therefore over-specified information the atlas may not possess.

## Decision

Physics consumes immutable Environment Atlas emission domain releases through a one-way, versioned product contract. Environment Atlas emission domain owns schema/format meanings and the conformance fixture. Physics implements `EmissionFieldProvider` using released atlas schema/format crates or an independent conforming decoder.

The adapter preserves `J_DNB`, corrected reference view, exact WGS84 support, source height/datum, profile states and joint model family, uncertainty/evidence/provenance/licence, and release identities. It constructs `ArtificialLightBoundarySource` only from compatible resolved profiles or an explicitly named scenario.

The projects retain separate Rust workspaces, internal models, revisions, Wasm packages, task schedulers, validation, and releases. They may run in one browser worker for efficient data ownership.

## Consequences

- Physics does not ingest or reinterpret raw VIIRS, inventories, OSM, or settlement priors.
- Environment Atlas emission domain does not adopt Physics' runtime spectral grid or atmospheric solver.
- Unresolved profiles never become silent typical-spectrum/Lambertian/constant defaults.
- Physics does not replay the satellite-path correction.
- The already-outgoing atlas value does not receive the initial ground BRDF twice; later atmosphere–surface orders remain Physics work.
- H3 remains retrieval hierarchy, while exact WGS84/ENU geometry drives propagation.
- Emission and Physics cache/model revisions remain independent but both enter downstream cache keys.
- Integration is verified with a shared emission-domain-owned native/Wasm conformance fixture.

The detailed consumer obligations are in [the Environment Atlas emission domain contract](../contracts/EMISSION_RELEASE_CONTRACT.md).

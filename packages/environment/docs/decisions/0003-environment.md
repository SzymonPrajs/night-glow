# ADR 0003: Name the combined package Environment

**Status:** accepted for planning

## Context

Night Glow requires spatially varying humidity, molecular state, aerosols and clouds along long curved-Earth light paths. Observer-only weather presets cannot represent polluted urban plumes crossing cleaner countryside. A separate weather workspace would duplicate global ingest, provenance, chunking, Wasm decoding, and release operations already required by the emission product.

## Decision

Use the final path and name `packages/environment/`, superseding the earlier
emission-only and atlas-style names. Add a separately versioned
atmospheric-state domain beside the existing surface-illumination domain.

The workspace may publish an `EnvironmentReleaseSet` that selects compatible releases. It does not merge emission and atmosphere into one cell type, model revision or build cadence.

Physics remains independent and solely owns optical-property construction and propagation.

## Consequences

- Shared engineering infrastructure becomes reusable.
- The short name is symmetric with `packages/physics/`, avoids implying that the
  scientific products are merely cartographic atlases, and still covers every
  environment field displayed on the globe or consumed by Physics.
- Documentation and package names must always identify the domain to avoid ambiguous “atlas release.”
- Atmospheric raw data volume and update cadence are much larger; dedicated storage and operations plans are required.
- Licences must be tracked per variable/source/output partition.
- A future independent repository split remains possible because domain contracts and crates stay one-way and versioned.

## Rejected alternatives

- **Keep weather in Viewer:** duplicates physics inputs in UI and cannot represent volume state.
- **Keep presets in Physics:** useful only as explicit fallback fixtures, not real environmental evidence.
- **Merge atmospheric state into emission cells:** incompatible dimensionality, cadence and meaning.
- **Pre-propagate global skyglow:** binds source, atmosphere, observer and model too early.

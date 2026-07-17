# Planned schemas

The two domains receive independent schema families and revisions:

```text
schemas/
  common/       units, coordinates, provenance, licences, hashes, evidence
  emission/     normalized observations, posterior cells, profiles, chunks, manifests
  atmosphere/   source runs, vertical coordinates, state fields, climatology, chunks, manifests
  release-set/  optional compatibility manifest only
  fixtures/     native/Wasm boundary conformance cases
```

Machine-readable emission schemas will be created only after the Black Marble feasibility experiment confirms exact quantities, corrected reference-view meaning, QA semantics, and joint spectrum/angle normalization. Atmospheric schemas require a separate vertical-coordinate/chunk experiment and native/Wasm round trip before revision 1 is frozen.

The normative handoffs are [surface emission](../docs/emission/physics-handoff.md) and [atmospheric state](../docs/atmosphere/physics-handoff.md). Each schema must encode its meanings and ship a tiny native/Wasm conformance fixture. Serialization must never create physical defaults, merge release cadences, or turn an optional `EnvironmentReleaseSet` into a combined scientific record.

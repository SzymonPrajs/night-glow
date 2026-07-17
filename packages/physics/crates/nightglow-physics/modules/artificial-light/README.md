# Artificial light

Owns conversion of a validated Environment emission domain batch into spectral/angular/time-dependent outgoing propagation source terms.

Inputs: cells carrying `J_DNB [W sr^-1]` for a declared corrected DNB reference view; exact WGS84 support and vertical support; tagged resolved/unresolved spectral, angular, and temporal profiles; joint model-family identity; evidence, uncertainty, provenance, and active scenario policy. Outputs: `ArtificialLightBoundarySource` records compatible with radiative transfer, or an explicit insufficient-evidence/bound result.

Raw VIIRS correction, cloud/moon/snow screening, DNB source reconstruction, inventories, luminaire/source fusion, and OSM/built-surface redistribution belong to Environment emission domain. This module verifies schema/profile compatibility, evaluates time with explicit context, projects resolved spectra into the Physics basis, evaluates the source-local angular model, and propagates evidence/uncertainty.

It never converts unresolved profiles through hidden defaults, multiplies `J_DNB` by `pi` without a named Lambertian scenario, or treats H3 average geometry as physical geometry. The Environment value is already outgoing and may include first-reflected lamp light; this module must not apply the ground BRDF to it again. Subsequent atmosphere–surface reflection orders remain radiative-transfer responsibilities.

Environment emission domain remains the authority for its release/schema, H3 hierarchy, source evidence, and `J_DNB`. This module owns only the Physics conversion and propagation semantics defined by [the consumer contract](../../../../docs/contracts/emission-release.md).

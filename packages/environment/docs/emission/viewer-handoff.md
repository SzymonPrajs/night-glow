# 19. Viewer handoff

The main Viewer has two modes and two relationships with Environment:

1. **Globe view:** consumes deterministic display products derived independently
   from an `EmissionRelease` or `AtmosphereFieldRelease`.
2. **Observer view:** never converts display colours into Physics inputs. Physics
   queries the scientific releases, propagates sources through the atmosphere,
   and sends observer radiance products to the renderer.

The full application plan is maintained independently in
[`../../../../apps/viewer/README.md`](../../../../apps/viewer/README.md), especially its
[data contracts](../../../../apps/viewer/docs/architecture/data-contracts.md) and
[globe plan](../../../../apps/viewer/docs/product/globe.md).

## 19.1 Direct globe products

Scientific releases remain authoritative. Browser `EnvironmentDisplayProduct` derivatives may be built
because scientific H3/volume chunks are not necessarily optimal for a global map.
Each display product must:

- derive reproducibly from exactly one immutable domain release and build revision;
- name a physical quantity/statistic and unit (`J_DNB`, PM2.5, 550-nm AOD,
  humidity, cloud fraction, confidence, and so forth);
- preserve spatial, vertical/column/surface and temporal support;
- preserve `AtmosphereSelectionMode`, forecast source run/analysis/valid/lead/member, observation-correction, climatology-model/sample or standard-scenario semantics;
- define aggregation, LOD, uncertainty, `DataValidity`, domain status and interpolation while leaving `RuntimeAvailability` to Viewer;
- carry schema/model/release IDs, hashes, provenance, licence and attribution;
- expose numeric values separately from palette, exposure and display emphasis.

An atmospheric column total is not a surface value and a selected altitude slice
is not a full volume. A display AOD or PM layer is never silently substituted for
the state volume Physics needs.

Environment owns deterministic display-product construction and conformance
to its source release. Viewer owns tile selection, GPU decode/upload, palette,
legend, time/altitude controls, picking and resource lifetime.

## 19.2 Display manifest

```text
EnvironmentDisplayProduct {
  environment_display_schema_revision
  environment_display_build_revision
  environment_display_product_id
  source_domain                 # emission | atmosphere
  source_emission_identity? {
    emission_schema_revision
    emission_model_revision
    emission_release_id
  }
  source_atmosphere_identity? {
    atmosphere_schema_revision
    atmosphere_model_revision
    atmosphere_release_id
  }
  source_manifest_hash

  quantity
  unit
  aggregation_semantics
  coordinate_and_vertical_support
  spatial_levels
  requested_time_utc?
  emission_time_context?
  atmosphere_selection? {
    mode: AtmosphereSelectionMode
    source_run_id?
    analysis_time_utc?
    valid_time_utc
    lead_duration?
    ensemble_member_id?
    observation_correction_revision?
    climatology_model_revision?
    climatology_sample_id?
    standard_scenario_id?
  }
  data_validity_encoding
  coverage_status_encoding?          # emission only
  source_evidence_class_encoding?    # atmosphere only
  uncertainty_encoding

  tile_or_chunk_descriptors
  query_index_descriptor
  recommended_display_presets   # non-normative
  provenance_licence_attribution
}
```

Exactly one source-identity group is present and must match `source_domain`.

## 19.3 Selection and observer transition

The globe commits WGS84 coordinate, explicit height/datum, `requested_time_utc`, independent
emission and atmospheric releases, `AtmosphereSelectionMode` and run/member/sample/scenario selection, and
source-scenario policy. These form one immutable Physics `ObserverScenario`. Place
labels, globe camera, palette, visible bounds and zoom do not affect Physics.

Viewer may preview local numeric values. Physics still selects the complete
source-to-observer emission and atmospheric domains; globe visibility never
becomes a transfer cutoff.

## 19.4 Additional pollution layers

The Viewer's generic layer interface is not an Environment schema. Noise,
water quality or unrelated pollution can have different dimensions, units and
evidence. Light emission and atmospheric state each plug into Viewer through
their own manifests. A displayed layer becomes a Physics input only through a
reviewed scientific contract, never merely because it can be coloured on a map.

## 19.5 Compatibility and fixtures

Conformance fixtures include planetary/regional/local LOD; numeric queries;
surface, column and altitude-slice semantics; forecast and climatology identities;
uncertainty, `DataValidity`, emission `CoverageStatus`, atmospheric evidence and runtime-availability distinctions; antimeridian/polar cases;
and incompatible/corrupt manifests. Environment tests derivation and values,
Viewer tests map decode/projection/picking/palette independence, and Physics tests
scientific product consumption and propagation without using display products.

## 19.6 Responsibility matrix

| Concern | Environment | Viewer | Physics |
| --- | --- | --- | --- |
| Emission reconstruction | owns emission domain | never repeats | never repeats |
| Atmospheric state fusion/climatology | owns atmosphere domain | never repeats | never repeats |
| Scientific release schemas | owns independently | selects/queries | consumes |
| Derived globe display products | owns build/conformance | consumes/displays | never consumes |
| Palette, legend, layer/time/altitude UI | semantics/hints only | owns | none |
| Globe pin and observer route | none | owns | consumes committed scenario |
| Source/atmosphere transfer domains | supplies chunks/bounds | none | owns selection |
| State-to-spectral-optics closure | supplies state/diagnostics | none | owns |
| Observer sky radiance | none | renders only | owns |
| Generic non-optical pollution API | no automatic ownership | owns UI contract | separate contract if relevant |

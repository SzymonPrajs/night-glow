# Viewer integration contract

Physics is independent from the main Viewer. It accepts immutable observer scenarios and publishes versioned, physically meaningful render products. It does not import React, MapLibre, Three.js, browser route state, palettes, panels, or Vercel APIs.

The [unified system contract](../../../docs/system-contract.md) is normative for `ObserverScenario`, `ObserverRenderProductSet`, selection/evidence vocabularies, revision identities and lifecycle names.

The application-side plan is [`../../../viewer/README.md`](../../../viewer/README.md), with normative Viewer expectations in its [data contracts](../../../viewer/DATA_CONTRACTS.md), [observer plan](../../../viewer/OBSERVER_VIEW.md), and [rendering/worker plan](../../../viewer/RENDERING_AND_WORKERS.md).

## 1. Two-view boundary

Physics participates only in the observer view:

```text
Environment releases -> Physics -> observer HDR render products -> Observer Viewer
```

The Globe Viewer may visualize Environment Atlas display products directly: surface emissions, PM/AOD/cloud/humidity slices or column summaries, uncertainty and evidence. Physics does not generate their palette tiles, and the globe's camera, zoom, visible cells or colour normalization do not define a transfer domain. When the user commits a pin, the Viewer creates a complete observer scenario and Physics independently selects required emission and atmosphere chunks through its curved-Earth propagation bounds.

## 2. Input scenario

The Viewer sends the canonical immutable `ObserverScenario` containing:

- `observer_scenario_schema_revision`;
- Viewer-assigned `scenario_revision`;
- WGS84 latitude/longitude and explicit observer height/datum;
- `requested_time_utc` plus required astronomy time-data identities;
- independent `EmissionRelease` and `AtmosphereFieldRelease` identities;
- emission time context and optional emission scenario-policy ID;
- canonical `AtmosphereSelectionMode` and conditionally required source run/analysis/valid/lead/member, observation-correction, climatology-model/sample or standard-scenario identity;
- interpolation/downscaling revisions;
- Physics model, data-manifest and `atmosphere_optics_model_revision` requests;
- terrain and surface product IDs;
- source-profile scenario policy where Atlas evidence is unresolved;
- output angular domain/projection and spectral/observer response;
- requested quality target and resource budget.

UI labels, local timezone formatting, palette, exposure, panels, globe camera and mini-map preview are not Physics inputs. Only a committed location/time creates a scenario.

## 3. Outputs and coherent barriers

Physics publishes the product families defined by [the WebGL contract](WEBGL_CONTRACT.md) as an atomic `ObserverRenderProductSet`. Its envelope contains render-product schema, Physics model/data, scenario and dependency revisions; coordinate/projection; shape/stride/type; units/basis; `DataValidity`; LOD/fidelity; numerical convergence/residual; masks and uncertainty.

Physics also publishes coherent barriers:

- `coarse_complete`: every required visible family is ready for one scenario and coarse fidelity tier;
- `refined_complete`: a higher complete tier is ready;
- optional tile refinements only where the descriptor defines safe mixed-LOD reconstruction.

The Viewer may retain an old coherent result while updating. Physics must never describe a mixture of old and new astronomy/atmosphere/source products as one complete tier.

## 4. Progress vocabulary

Progress comes from the solver DAG, not UI-invented ordering. Each event includes scenario revision, one canonical parent stage (`resolve_inputs`, `load_environment`, `build_geometry_astronomy`, `build_optical_state`, `solve_transfer`, `apply_observation`, `publish_products`, or `refine`), optional domain substage, completed/estimated work, available quality tier, convergence/error where defined, and memory/asset waits where useful.

Stage names should be stable enough for friendly Viewer labels while detailed substeps remain diagnostic. “Weather first, planets later” is not a public ordering guarantee unless the computation DAG and dependency analysis make it so for that product tier.

## 5. Display boundary

Physics owns:

- radiance and calibrated source/body/star quantities;
- spectral/observer basis definitions;
- physical PSF products and permitted reconstruction rules;
- numerical fidelity/convergence/residual, `DataValidity`, masks and uncertainty as separate axes.

Viewer owns:

- camera projection and GPU resource management;
- composition exactly as specified by render descriptors;
- exposure/adaptation, tone mapping, gamut/output transfer exactly once;
- optional explicitly separate artistic bloom;
- labels, legends, interaction and accessibility.

Physics parameters never appear as shader-only UI substitutes. Display-only changes should not require a new Physics solve when retained HDR products are sufficient.

## 6. Worker and lifecycle expectations

The browser baseline is one coordinator worker hosting Physics Wasm and optionally an Atlas decoder dependency. Calls are scenario/batch/tile sized. Outputs use transferable buffers or stable Wasm views with explicit invalidation; no per-star, per-cell or per-ray JavaScript loop exists.

Every job checks cancellation between bounded blocks. Outputs echo the revision. Completed caches are populated only after validation and cannot be poisoned by cancelled work. Physics exposes explicit release handles so the Viewer can bound memory on route changes.

Threads are an optional capability tier. The single-worker path remains correct, and cross-origin isolation is not assumed by scientific code.

## 7. Compatibility

Physics advertises:

- supported `physics_abi_revision` range;
- supported `observer_scenario_schema_revision` range;
- supported `observer_render_product_schema_revision` families/ranges;
- required/optional browser capabilities;
- supported emission and atmosphere schema/profile/selection features;
- available quality profiles and memory estimates;
- data/model manifest identities.

The Viewer rejects unsupported mandatory semantics rather than guessing. Physics revision changes and Viewer deployment changes remain independent.

## 8. Shared validation

Physics supplies tiny observer fixtures with known diffuse fields, stars, finite bodies, PSF basis and quality masks. Viewer conformance tests verify decode, upload, projection, flux preservation, composition and display transforms. Physics retains numeric authority for the expected physical products.

End-to-end fixtures also test:

- globe-selected WGS84/time/release round trip into the scenario;
- rapid committed changes and stale-revision rejection;
- coherent coarse/refined barriers;
- display-only changes without recomputation;
- context loss/worker restart and deterministic re-request;
- exact provenance across both Environment Atlas products, source run/sample/scenario, Physics and Viewer revisions;
- honest forecast/reanalysis/climatology labels and coherent atmosphere/emission switching.

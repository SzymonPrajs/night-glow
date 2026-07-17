# Viewer data contracts

## 1. Contract philosophy

The Viewer depends on products, not source code. Environment and Physics remain independently versioned Rust/Wasm projects. Inside Environment, emission and atmosphere are also independently versioned domains. Every crossing includes units, reference frame, spatial/vertical/time support, schema identity, `DataValidity`, domain status, evidence, uncertainty, provenance and—only for computed outputs—fidelity/convergence.

The repository [unified system contract](../../../../packages/contracts/README.md) is normative for all capitalized product/type names, revision/time fields, atmosphere selection/evidence values and validity/runtime-state enums used below.

The Viewer has two separate scientific inputs:

```text
EmissionRelease ──surface display product──────────> Globe Viewer
AtmosphereFieldRelease ──surface/column/slice display product──> Globe Viewer
EmissionRelease + AtmosphereFieldRelease ──providers──> Physics
Physics ──observer products────────────────────────> Observer Viewer
```

No shortcut sends globe display colours into the observer renderer.

## 2. Environment → Globe contract

Each Environment domain owns its authoritative release and conformance fixture. A separate deterministic display-build tool may derive an `EnvironmentDisplayProduct`, but its manifest must include:

- source domain plus release ID and schema/model revision;
- display-product build revision and source hashes;
- quantity and units (`J_DNB [W sr^-1]`, surface PM2.5, column AOD, humidity/cloud at a declared level, or another explicitly derived statistic);
- cell/area/volume/column/altitude-slice and aggregation semantics;
- WGS84/H3/projection, vertical coordinate/support and zoom mapping;
- emission time context or atmospheric evidence/run/valid/lead/member/climatology-sample context;
- source-profile or atmospheric evidence/uncertainty state;
- `DataValidity` and domain-specific coverage/status, with no serialized runtime availability (the Viewer derives `RuntimeAvailability` from fetch/decode state);
- normalization recommendations that do not alter stored values;
- licence, attribution and provenance.

Globe display tiles are not a new physical authority. Queries return authoritative values or clearly identified aggregates, not inverse-paletted colours. An atmospheric display column/slice is never the full state volume supplied to Physics.

## 3. Environment → Physics contracts

The Viewer helps select independent releases and supplies runtime URLs/handles, but Physics consumes scientific semantics through its documented `EmissionFieldProvider` and `AtmosphereFieldProvider`. The emission handoff preserves:

- source value starts at `J_DNB [W sr^-1]`;
- profile states are explicit, including unresolved;
- lookup is WGS84/H3 and conversion into Physics coordinates is declared;
- temporal evaluation is performed once under `EmissionTimeContext`;
- satellite-view correction is never applied twice;
- surface reflection/BRDF terms have one owner per path;
- emission and Physics revision identities remain separate.

The atmosphere handoff preserves `atmosphere_release_id`, `AtmosphereSelectionMode`, `source_run_id`, analysis/valid/lead/member or climatology/standard identity, `observation_correction_revision`, `climatology_model_revision`, coordinates and vertical levels, variables/units, wet/dry aerosol convention, `DataValidity`, `SourceEvidenceClass`, uncertainty, provenance and licence. Physics selects a full source-to-observer region and alone converts `AtmosphereStateVolume` into `OpticalAtmosphereState`. PM/AOD/display tiles do not substitute for that volume.

See the Physics [Environment contract](../../../../packages/physics/docs/contracts/environment.md), detailed [emission contract](../../../../packages/physics/docs/contracts/emission-release.md), and Environment producer handoffs for [emission](../../../../packages/environment/docs/emission/physics-handoff.md) and [atmosphere](../../../../packages/environment/docs/atmosphere/physics-handoff.md).

## 4. Physics → Observer contract

Physics publishes a capability handshake and one coherent `ObserverRenderProductSet` per scenario/tier. Its common envelope contains:

```text
ObserverRenderProductSet
  observer_render_product_schema_revision
  physics_model_revision
  physics_data_manifest_id
  scenario_revision
  coherent_tier
  dependency_ids
  products[] {
    product_id and family
    coordinate_frame and projection
    dimensions, strides, tiles and borders
    scalar type, byte order and packing
    spectral_basis_id or observer_response_id
    physical quantity, units and scale
    validity region/time and DataValidity
    LOD/fidelity, convergence/residual, masks and uncertainty
    buffers or immutable asset references
  }
```

Initial families:

| Family | Required semantics | Typical GPU destination |
| --- | --- | --- |
| `sky_radiance` | spectral/basis radiance by direction | float 2-D/cube/array textures |
| `star_batch` | direction, flux/basis, PSF/flags | interleaved VBO/texture buffers |
| `body_batch` | finite disk geometry and calibrated radiance parameters | compact buffers/textures |
| `surface_terrain` | horizon, visibility, surface contribution | geometry and textures |
| `psf_basis` | normalized kernels/basis with spatial rules | float texture/buffer |
| `diagnostics` | separate validity, fidelity, convergence/residual, masks and uncertainty | diagnostics textures/buffers |

The renderer maintains an allowlist of supported `observer_render_product_schema_revision` values/ranges. Unknown revisions fail closed with a compatibility message.

## 5. Application layer plugin contract

Pollution layers use a broader Viewer-owned manifest because they need not share Environment physics:

```text
LayerManifest
  layer_manifest_schema_revision
  layer_id and release_id
  title, description, licence and provenance
  domain_type: surface_scalar | surface_vector | column | volume | station | event
  quantity and unit
  coordinate_reference and spatial support
  temporal_support and interpolation policy
  uncertainty, DataValidity and domain-status mappings
  tile/source descriptors
  allowed/default display normalizations and palettes
  query and attribution capabilities
```

`RuntimeAvailability` belongs to Viewer state and is not serialized as scientific data in the layer manifest. This layer contract never changes the scientific input expected by Physics. A future layer can become a Physics input only through a separate reviewed scientific contract.

## 6. Coordinate and time rules

- UI location uses WGS84 latitude/longitude and a height with explicit datum.
- No bare `[x,y,z]` crosses a package boundary; frame and axis order are named.
- Scientific time uses `requested_time_utc`, `analysis_time_utc`, `valid_time_utc`, `lead_duration` and `time_support` exactly as defined by the unified contract, plus whatever UT1/TT/EOP identities Physics requires for astronomy.
- Local civil time is presentation only and includes timezone identity and offset.
- Longitude wrapping, antimeridian behavior, poles and ENU basis conventions have shared fixtures.
- The Viewer never infers metres versus kilometres, degrees versus radians, or radiance versus radiant intensity.

## 7. Revision compatibility

At startup the runtime evaluates:

```text
viewer_contract_revision
  × observer_scenario_schema_revision
  × environment_manifest_schema_revision
  × emission_schema_revision
  × atmosphere_schema_revision
  × environment_display_schema_revision
  × physics_abi_revision
  × observer_render_product_schema_revision
  × layer_manifest_schema_revision
  × renderer/Wasm capability profile
```

Each item is exchanged as a supported value/range as appropriate. Model, release,
build and data-manifest identities are then checked for semantic compatibility
and pinned in the scenario/product dependencies.

Compatibility is explicit and testable. An emission or atmosphere release is not invalid merely because Physics has a new model, and a new Viewer does not relabel old scientific products as current. Cache keys include all identities that can change a result.

## 8. Conformance fixtures

Required shared fixtures:

1. Emission cell/profile/time cases with exact `J_DNB` and state flags.
2. Atmosphere volume cases with exact coordinates/levels/run/evidence/wet-dry/missingness semantics.
3. Coordinate cases at equator, poles, antimeridian and known ENU directions.
4. Physics render descriptors with tiny synthetic radiance/star/body products.
5. Coherent multi-product revisions and deliberately stale/corrupt variants.
6. Display-transform reference probes for linear input through final output.
7. A globe pin → observer scenario round trip preserving coordinates/time/releases/evidence/sample.

Fixtures are language-neutral binary plus human-readable metadata where practical. The owning scientific package defines expected physical values; the Viewer defines decoding/upload/display expectations.

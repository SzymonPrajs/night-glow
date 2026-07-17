# 18. Physics handoff contract

This document defines Environment side of the boundary with an independent atmospheric propagation project. Environment remains a standalone source-reconstruction product. The propagation solver remains a standalone physics product. They communicate through versioned release artifacts and a small physical vocabulary; neither project imports the other's orchestration, models, or internal state.

The future machine-readable schema under `schemas/` is normative for bytes. This document is normative for meanings. A consumer-specific restatement may exist in another project, but it may not redefine the quantities below.

In this checkout, the independent Physics project's consumer-side restatement is [Physics: Environment emission domain consumer contract](../../../physics/docs/contracts/emission-release.md). The separate main application's two consumption paths are described in [the Viewer handoff](viewer-handoff.md).

## 18.1 One-way product dependency

```text
raw light observations and source evidence
          │
          ▼
Environment emission domain native pipeline
          │
          ▼
immutable EmissionRelease + dictionaries + chunks
          │
          ▼
Physics emission adapter
          │
          ▼
ArtificialLightBoundarySource -> atmospheric propagation
```

Environment never depends on the physics solver. Physics may consume a published Environment schema/decoder crate or implement a separate decoder that passes Environment conformance fixtures. This is a one-way product dependency, not a shared workspace requirement.

## 18.2 Canonical vocabulary

| Term | Canonical meaning | Owner |
| --- | --- | --- |
| `EmissionRelease` | Immutable release manifest, dictionaries, chunks, provenance, and attribution | Environment emission domain |
| `SurfaceEmissionCell` | One mixed-resolution surface support record selected by Environment hierarchy | Environment emission domain |
| `J_DNB` | DNB-response directional intensity integrated over the cell's exact surface support, in `W sr^-1`, for a declared corrected reference-view convention | Environment emission domain |
| `SpectralProfile` | Source spectral shape/support and uncertainty; not an absolute amplitude by itself | Environment emission domain |
| `AngularEmissionProfile` | Upward angular emission function and normalization relative to a declared reference view; may be unresolved | Environment emission domain |
| `TemporalProfile` | Multiplicative source behavior normalized to exactly 1 at the baseline reference phase; may be unresolved | Environment emission domain |
| `EmissionModelFamily` | Joint compatibility identity for spectrum, angle, and source class | Environment emission domain |
| `CoverageStatus` | Supported emission, supported dark/upper-bound, or no evidence | Environment emission domain |
| `EmissionTimeContext` | Explicit UTC/civil/solar/sunset context supplied for temporal evaluation | Caller/Physics/application |
| `EmissionFieldProvider` | Physics-side streaming/query adapter over an `EmissionRelease` | Physics |
| `ArtificialLightBoundarySource` | Wavelength-, direction-, time-, and geometry-resolved outgoing source accepted by radiative transfer | Physics |
| `ObserverRenderProductSet` | Coherent observer-radiance/render product family after atmosphere, terrain and subsequent surface coupling | Physics |

Never use `brightness`, `power`, `flux`, `radiance`, and `intensity` interchangeably. `J_DNB` is not total upward flux, spectral power, photopic lumens, or observer sky radiance.

## 18.3 Canonical record at the boundary

The conceptual consumer record is:

```text
SurfaceEmissionCell {
  cell_id: H3 index used for lookup only
  support: exact cell geometry / area semantics
  reference_epoch
  coverage_status

  dnb_directional_intensity: J_DNB [W sr^-1]
  dnb_uncertainty
  dnb_response_id
  corrected_reference_view

  spectrum_profile: resolved(profile_id) | unresolved
  angular_profile: resolved(profile_id) | unresolved
  temporal_profile: resolved(profile_id) | unresolved
  emission_model_family_id

  source_vertical_support
  evidence_bits
  quality_class
  censoring
  uncertainty_components
  posterior_method_id
  provenance_handles
}
```

An unresolved profile is a first-class tagged state, never dictionary ID zero, an empty vector, or an implicit default. Supported dark/upper-bound and no evidence are distinct from zero emission.

## 18.4 Coordinates and directions

- Geographic positions use WGS84 geodetic latitude/longitude; latitude is north-positive and longitude east-positive.
- Stored elevation/height declares vertical datum and whether it is terrain/DSM elevation, source height above local surface, or ellipsoidal height. Physics resolves these against its own terrain model without adding the same elevation twice.
- H3 is an index and retrieval hierarchy. Its spherical average areas and centres are not propagation geometry. Area integration and physical paths use exact declared support and validated WGS84/ellipsoidal geometry.
- An emission direction is an outward propagation direction in a source-local right-handed east–north–up tangent frame.
- Emission zenith angle `theta` is `0` along local up and `90 degrees` at the local horizontal.
- Absolute emission azimuth `phi` is `0` at true geodetic north and increases eastward. Feature-relative harmonics declare their separate orientation explicitly.
- The corrected DNB reference view stores the same direction/frame convention. The exact Black Marble corrected-view meaning remains a Phase-0 feasibility question; no consumer may assume nadir or Lambertian behavior while it is unresolved.

## 18.5 Spectral contract

- Wavelengths are vacuum nanometres unless a future schema explicitly declares otherwise.
- Spectral densities state whether they are per nanometre and whether they represent radiant power, intensity, radiance, or a dimensionless normalized shape.
- Environment preserves its high-resolution source representation and exact DNB response identifier. It does not resample to Physics' current eight-band migration grid.
- Physics chooses its runtime basis and performs a versioned, error-tested projection from an Environment profile.
- A resolved spectral/angular family must forward-predict the source's `J_DNB` through the stored DNB response and corrected reference view within the declared uncertainty.
- If spectrum is unresolved, `J_DNB` cannot be silently spread across visible bands. Physics must return insufficient evidence, propagate a conservative interval if supported, or apply an explicitly named scenario whose identity enters the cache/result metadata.
- Narrow-line components remain explicit when required for sodium or other structured emitters.

## 18.6 Angular contract

The angular profile declares its normalization kind. The baseline candidate is normalization against the corrected DNB reference direction, not unit hemispheric integral. The profile also records a hemispheric integral only when evidence/model support makes it meaningful.

Physics must not:

- multiply `J_DNB` by `pi` unless a named Lambertian scenario is selected;
- treat a nadir-direction measurement as total upward flux;
- choose spectrum and angle independently when their `EmissionModelFamily` identities are incompatible;
- manufacture near-horizontal emission from an unresolved profile.

If angle is unresolved, the same policy choices apply as for unresolved spectrum: insufficient evidence, a supported bound, or an explicit scenario.

## 18.7 Time contract

The baseline is tied to a declared acquisition/composite reference phase. A resolved `TemporalProfile` evaluates to exactly 1 at that phase. Temporal evaluation accepts an explicit `EmissionTimeContext` containing only the fields required by the chosen profile:

```text
EmissionTimeContext {
  requested_time_utc
  civil_time? + iana_zone_id? + tzdb_revision?
  local_apparent_solar_time?
  sun_altitude? + hours_since_sunset? + hours_until_sunrise?
  weekday/holiday/event class?
}
```

Environment applies profile semantics; it does not implement leap seconds, ephemerides, time-zone discovery, or solar geometry. Physics/astronomy supplies astronomical fields and the application supplies authoritative civil-zone/policy context. Missing required context returns factor 1 with unresolved status; longitude is never silently substituted for a civil time zone.

## 18.8 Initial surface boundary and later reflection

The corrected Environment value is an outgoing surface-side signal. It may already contain direct upward fixture/facade light and downward light that reflected from the surface before escaping upward. Unless a profile explicitly separates these components, Physics consumes their combined outgoing result.

Physics must not apply its ground BRDF to this initial Environment signal as if the whole value were downward incident light. That would double count the first surface reflection. After emission enters the atmosphere, any subsequent atmosphere-to-ground-to-atmosphere reflection is a new transport order and remains Physics' responsibility.

Environment correction reconstructs the source-side DNB signal from the satellite observation. Physics propagates that source along a new source-to-observer path. It does not undo or reapply the original satellite-path atmospheric correction.

## 18.9 Uncertainty, evidence, and policy

The boundary preserves at least these separable uncertainty components: radiometric, sampling, spatial allocation, spectral, angular, temporal, and model discrepancy. Each component declares representation (for example interval, quantiles, or log-standard deviation), correlation/profile scope where known, and unresolved state.

Physics may compute a central result, bounds, or ensemble, but it must retain which components were omitted or collapsed. Scenario assumptions are not evidence. Results report active profile evidence class and scenario IDs.

## 18.10 Revisions and compatibility

The following identities are distinct:

| Identity | Changes when |
| --- | --- |
| `emission_schema_revision` | Required fields, binary layout, or semantic compatibility changes |
| `emission_model_revision` | Source-reconstruction, correction, fusion, or uncertainty mathematics changes |
| `emission_release_id` | Release inputs/configuration/coverage change |
| dictionary hashes | Spectrum/angular/temporal/elevation/method dictionaries change |
| `dnb_response_id` | Sensor response definition or integration convention changes |
| chunk content hash | Any chunk bytes change |
| `physics_model_revision` | Downstream propagation/source-adapter mathematics changes |
| `scenario_revision` | Runtime atmosphere, observer, time, profiles, or fidelity changes |

A consumer rejects unsupported major schema revisions and unknown mandatory semantics. Its cache key includes `emission_release_id`, exact chunk/dictionary identities, time/profile policy, spectral projection revision, and `physics_model_revision`. An `EmissionRelease` is never overwritten under an existing immutable URL.

## 18.11 Query and streaming shape

The logical interface remains coarse and chunk-oriented:

```text
open_emission_release(manifest, dictionaries) -> emission_release_handle
plan_emission_query(handle, region, time_context, source_policy) -> ChunkPlan
register_chunk(emission_release_handle, chunk_descriptor, bytes)
query_emission(handle, request)
    -> SurfaceEmissionBatch
```

`SurfaceEmissionBatch` uses contiguous arrays and shared dictionary references; it is not one JavaScript object per cell. It can be returned natively, decoded inside the Physics Wasm worker through a decoder dependency, or transferred as a coarse buffer between independent Wasm modules.

Environment chunk bounds contain total/bounded `J_DNB` and uncertainty. Only Physics can combine those with a transfer bound and decide whether distant unprocessed chunks are negligible. Environment never applies a fixed propagation radius.

## 18.12 Independent Wasm packages

`environment-wasm` exposes independently versioned emission and atmosphere release decoders/query handles. Physics Wasm is a propagation solver. They may be deployed in one coordinator worker for efficient memory ownership, but remain independent packages with separate versions and tests. Independence does not require a JavaScript call per cell or separate worker per package.

Native ingestion/fusion crates never compile into the browser. The consumer-facing Environment schema/core/format crates must compile for native and `wasm32-unknown-unknown` without GDAL, HDF5, filesystem, or network assumptions.

## 18.13 Boundary conformance fixture

Environment will publish a tiny open fixture containing:

- one resolved spectrum/angle/time cell with a forward-predictable `J_DNB`;
- one unresolved-profile cell;
- supported-dark/upper-bound and no-evidence cases;
- mixed H3 resolutions with no ancestor/descendant overlap;
- a profile requiring civil time and one requiring solar context;
- separable uncertainty components;
- exact support/height/direction metadata;
- chunk intensity bounds, provenance, and attribution;
- deliberately corrupt/incompatible cases.

Environment tests prove decode, hierarchy, conservation, DNB forward prediction, profile normalization, missing-state behavior, and native/Wasm parity. Physics tests prove it consumes the same fixture without changing `J_DNB`, double-correcting the atmosphere, defaulting unresolved profiles, double-reflecting the surface, or losing uncertainty/provenance.

## 18.14 Responsibility matrix

| Concern | Environment emission domain | Physics |
| --- | --- | --- |
| Raw VIIRS/inventory/OSM/WSF ingest and fusion | owns | never repeats |
| DNB correction/view semantics and `J_DNB` | owns | consumes/validates compatibility |
| H3 mixed-resolution hierarchy and release chunks | owns | queries/streams |
| Spectral/angular/temporal profile evidence | owns | projects/evaluates with explicit policy |
| UTC/astronomy/solar geometry | consumes explicit context only | owns with astronomy/application |
| Exact propagation geometry and terrain horizon | provides source support/height evidence | owns |
| Atmosphere, clouds, aerosols, subsequent BRDF orders | never bakes in | owns |
| Adaptive source-domain tail termination | provides chunk intensity bounds | owns transfer bound/stopping decision |
| Source-only validation | owns | may consume reports |
| Propagation validation | supplies frozen source fixture | owns |
| End-to-end validation | joint frozen versions; errors remain separable | joint frozen versions; errors remain separable |
| Observer display/WebGL/tone mapping | never owns | publishes downstream render products only; Viewer owns display |

## 18.15 Blocking items before schema v1

- Confirm the exact corrected Black Marble reference-view convention.
- Select the normalization algebra for joint spectral/angular profiles and demonstrate DNB forward closure.
- Freeze coordinate, height/datum, wavelength, and uncertainty encodings.
- Decide whether Physics consumes published `environment-format`/`environment-schema` crates or maintains an independent conforming decoder.
- Agree the first conformance fixture and compatibility/error codes.
- Complete licence review for any product embedded in Physics precompute or deployment caches.

# ADR 0001: first vertical-slice conventions and scope

- Status: accepted for the first conformance slice
- Date: 2026-07-17
- Applies to: contract fixture revision `nightglow-fixture-v1`

## Context

The architecture documents deliberately leave production data, solver and
rendering choices open. Implementation cannot start safely until a small slice
has complete quantities, conventions and error targets. This decision freezes
only the first synthetic, openly redistributable slice. It does not make a
synthetic fixture evidence for production accuracy.

## Decision

The first slice uses the following explicit conventions:

- WGS84 geodetic longitude/latitude, east-positive longitude, and right-handed
  east-north-up local directions;
- WGS84 ellipsoidal metres for observer/source heights and geometric metres above
  the same ellipsoid for atmospheric levels;
- RFC 3339 UTC instants, with astronomy calculations also pinning a leap-second
  table revision and an Earth-orientation revision; the fixture does not infer
  UT1 or TT from an unversioned clock;
- vacuum wavelengths and the existing eight explicit rectangular bands, from
  405–707.5 nm, as a *fixture basis*, not a production-accuracy claim;
- scalar, unpolarized radiance and a spherical Earth with radius 6,371,008.8 m;
- `f64` as the native reference precision and `f32` as the transport/render
  precision, with parity bounded by the acceptance manifest;
- a deterministic direct/single-scattering reference case before any
  interactive approximation, multiple scattering, terrain correction, cloud
  transport, or GPU compute is accepted;
- linear HDR radiance buffers. Exposure, palette, gamut mapping and tone mapping
  are Viewer-only state and are absent from the scenario identity.

For emission, `J_DNB` is a corrected-reference-view band-integrated directional
radiance in `nW cm-2 sr-1`. Multiplying it by exact cell support area produces a
directional intensity in `W sr-1`; it is never silently treated as hemispheric
flux. Missing, masked, censored, valid zero and supported upper-bound states are
distinct. Spectrum, upward angular distribution and within-night behavior may be
unresolved; Physics may only resolve them through an explicit, revisioned
scenario policy.

The first fixtures are authored in this repository, dedicated to the public
domain under CC0-1.0, and contain no provider, OSM or personal-location data.
They therefore unblock contract and numerical work without deciding the
redistribution terms or ingestion details of a production source.

The production Viewer remains `apps/viewer/`; the runnable Vite application
remains `apps/reference-viewer/` until cutover gates pass. The first coordinator
baseline is one module worker, transferable buffers, WebAssembly without
threads, and WebGL2. Threads, OffscreenCanvas and GPU scientific compute remain
capability-gated experiments.

## First-slice disposition of blocking registers

| Register | First-slice disposition |
| --- | --- |
| Environment product/SDS and daily processing | no provider ingestion in v1; provenance and provider-specific QA remain extensible |
| `J_DNB` convention and normalization | corrected-reference-view band directional radiance; support integration is explicit; spectrum/angle/time remain unresolved |
| fill/negative/background/censoring | the five canonical validity states are distinct and checked |
| OSM redistribution | OSM is absent from v1; licence-partition metadata is mandatory before it can enter a release |
| Environment decoder dependency | language-neutral fixtures are authoritative; consumers conform independently without importing ingestion code |
| Physics reference/interactive solver | analytic `f64` direct/single-scatter case first; no interactive approximation is selected without convergence evidence |
| spectral/polarization/geometry/precision | eight-band fixture basis, scalar radiance, spherical Earth, native `f64` and transported `f32` |
| production astronomy/catalogues/diffuse sky | only pinned synthetic descriptors and independent JPL vectors; production data choices remain out of schema v1 |
| Viewer workspace | production Next app at `apps/viewer`; the bounded proof stays below `apps/viewer/experiments/` and does not replace Vite |
| Viewer product barrier | `ObserverRenderProductSet` v1 publishes only atomic `coarse_complete` or `refined_complete` families |
| display products | emission and atmosphere derivatives retain independent source-release identity, quantity, unit, support and validity |
| shareable height/time | WGS84 ellipsoid height plus pinned UTC/leap-second/Earth-orientation identities |

## Explicitly deferred production choices

Black Marble SDS selection and daily-versus-annual processing, OSM-derived output
licensing, production basemap/CDN, production ephemerides, a calibrated spectral
basis, polarization, multiple-scattering solver family, atmospheric optical
closure and cloud transport still require their named experiments. The v1
schemas preserve provenance, unresolved evidence and revision fields so those
choices do not require inventing hidden defaults now.

## Consequences

- M0 can be checked with language-neutral fixtures and exact numerical targets.
- M1 experiments can reject an implementation without destabilizing production
  schemas or claiming scientific calibration.
- Any change to these meanings creates a new fixture/schema revision; it does
  not rewrite fixture v1 in place.

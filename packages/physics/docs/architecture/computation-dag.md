# Computation DAG and update order

The physical model is not a sequence of painted layers. It is a dependency graph whose intermediate results have explicit physical meanings. Independent work should run concurrently; dependent work must retain its order.

```mermaid
flowchart TD
    I["Observer, time, Earth orientation"] --> E["Ephemerides and apparent directions"]
    I --> Q["Resolve AtmosphereSelectionMode and canonical time/run identity"]
    Q --> W["AtmosphereFieldRelease: regional 4-D state"]
    I --> T["Terrain and surface state"]
    E --> S["Sun, Moon, planets, resolved stars"]
    C["Catalog and diffuse celestial tiles"] --> S
    L["EmissionRelease: J_DNB + profile states"] --> A["Emission adapter + explicit source policy"]
    W --> OS["Physics state-to-spectral-optics closure"]
    OS --> X["Atmosphere/surface transfer operator"]
    T --> X
    S --> X
    A --> X
    X --> R["Spectral radiance field at observer"]
    R --> P["Atmospheric + optical PSF"]
    P --> RP["ObserverRenderProductSet: linear HDR products"]
    RP --> D["Viewer: exposure, tone map, display colour"]
```

## 1. Scenario state

A scenario revision contains the complete canonical `ObserverScenario`: observer WGS84 position/height datum; `requested_time_utc` and astronomy data IDs; exact `EmissionRelease`; exact `AtmosphereFieldRelease` plus `AtmosphereSelectionMode`, source run/analysis/valid/lead/member, observation-correction, climatology-model/sample or standard-scenario identity; interpolation/downscaling and atmospheric-optics revisions; surface/terrain product IDs; catalogue revisions; spectral basis; fidelity profile; and instrument/eye observation model. See the [unified system contract](../../../contracts/README.md).

Every result is tagged with the scenario revision and the hashes of upstream assets. Late worker results from an older revision are discarded.

## 2. Required physical order

1. Convert time and observer state into Earth orientation and reference-frame transforms.
2. Compute geometric and apparent directions, distances, phases, occultations, and horizon intersections.
3. Resolve the declared `AtmosphereSelectionMode` and load an `AtmosphereStateVolume` covering the conservatively bounded source-to-observer scattering domain; load spatial/spectral LOD for stars, diffuse celestial sky, terrain, albedo, and artificial emission.
4. In Physics, convert meteorology/aerosol/cloud state into wavelength-dependent optical properties without losing vertical, wet/dry, uncertainty or missingness semantics; construct the surface boundary response.
5. Construct or select the reusable transfer operator for the atmosphere/surface state.
6. Evaluate source boundary conditions: solar, lunar, planetary, stellar, diffuse, airglow, zodiacal, and artificial.
7. Propagate sources through the common transfer operator, including multiple scattering and surface coupling according to fidelity.
8. Sum **linear spectral radiance** contributions only after each contribution is expressed on a compatible basis and grid.
9. Apply refraction and the observation PSF at the correct stage and angular support.
10. Produce HDR render resources; apply exposure and display colour exactly once in the renderer.

For artificial light, step 3 loads emission chunks and preserves `J_DNB`, exact support, profiles/status, uncertainty, and provenance. It also loads atmospheric chunks along the full relevant propagation volume—not only weather at the observer—so polluted urban air, elevated plumes and clouds can affect outgoing city light before that light reaches cleaner countryside. Step 6 constructs a wavelength/direction/time-resolved `ArtificialLightBoundarySource` only from compatible resolved profiles or an explicitly selected scenario. Raw VIIRS correction, weather assimilation, OSM/WSF disaggregation, and data fusion never run inside this DAG.

“Weather and sky first, then planets” is a useful scheduling intuition, but opacity and scattering cannot be finalized independently of direction and spectrum. The solver therefore builds reusable atmosphere/surface state first, computes celestial geometry in parallel, and joins them at source propagation.

## 3. Parallel branches

Once time/frame state exists, the following may run concurrently:

- Sun, Moon, and planetary ephemerides;
- stellar tile selection and proper-motion propagation;
- diffuse Milky Way and zodiacal tile selection;
- atmospheric release selection, chunk loading and regional state interpolation;
- terrain horizon and surface tile selection;
- artificial-emission tile selection;
- cached transfer/LUT lookup.

Per-source propagation can run concurrently only if the transfer formulation is linear for the selected state. Nonlinear coupling, such as cloud microphysics changes or a state-dependent observation model, requires a new transfer revision rather than unsafe summation.

## 4. Progressive refinement

The first visible result should be physically coherent, not a mixture of current and stale layers:

1. Coarse all-sky atmosphere and bright-source result.
2. Visible bright-star catalogue and coarse diffuse sky.
3. Refined horizon/terrain and local artificial emission.
4. Higher scattering order and angular refinement where estimated error is largest.
5. Fainter catalogue tiers, refined Milky Way tiles, and higher-quality PSF.

Each tile carries LOD, error estimate, scenario revision, and spectral/grid identity. Replacement is atomic at tile boundaries. Refinement priority is based on projected screen error, radiance contribution, and physical residual—not simply distance from the camera.

## 5. Cache hierarchy

| Cache | Key includes | Reusable across |
|---|---|---|
| Ephemeris | time range, body, ephemeris revision | nearby frames/times |
| Catalogue tile | sky cell, magnitude/quality tier, epoch basis | observers |
| Surface/emission tile | emission release/chunk/dictionary hashes, spatial cell, layer policy | times until the selected emission layer changes |
| Artificial source projection | `J_DNB`, time context, profile/scenario IDs, spectral projection, geometry | atmosphere states while source policy is unchanged |
| Atmosphere volume | atmosphere release, selection mode, run/analysis/valid/lead/member or climatology/standard ID, observation-correction and climatology-model revisions, exact chunks, fields, interpolation/downscaling revision, region/LOD | optical closures compatible with the same state semantics |
| Optical state | atmosphere-volume hash, wet/dry convention, `atmosphere_optics_model_revision`, wavelength basis, geometry | source directions within its declared support |
| Transfer LUT | optical state, geometry/grid, model revision | all linear sources |
| Source projection | source state, transfer hash | display changes |
| PSF kernel | seeing/instrument state, wavelength, angular sampling | sources in validity region |
| Render product | all physical hashes, output grid | exposure/tone-map changes where HDR retained |

Only completed, validated results enter shared caches. Cancellation must never publish partial LUTs or emission grids.

## 6. Non-blocking execution

- The main browser thread performs UI and WebGL submission only.
- One coordinator worker owns the Wasm solver and schedules bounded jobs.
- Optional additional workers use a shared Wasm memory only under cross-origin isolation.
- Without shared memory, jobs use transferable `ArrayBuffer`s and spatially coarse task boundaries.
- Every job has cancellation/revision checks at bounded intervals.
- Wasm calls are coarse: a tile, band block, star batch, or solve step—not one call per ray or pixel.
- Progress reports completed work, residual/error, and a canonical parent stage from the unified system contract; it never implies convergence merely from elapsed percentage.

Emission-chunk intensity bounds are source-side only. The solver combines them with atmosphere-field uncertainty and a conservative transfer bound to control outward source and atmospheric-domain expansion; it never interprets `J_DNB` bounds as observer radiance or adopts a fixed Environment radius.

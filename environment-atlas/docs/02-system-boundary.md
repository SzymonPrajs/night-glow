# 02. System boundary

## Three products, one physical chain

```text
light observations ──► surface emission release ────────┐
                                                        ├─► 3-D Physics solver ─► observer radiance
weather/composition observations ─► atmosphere release ─┘
```

The two Atlas domains describe independently versioned boundary/input fields. Physics describes transport to an observer. They can ship in one workspace and release set without pre-propagating illumination through one fixed atmosphere or correcting the same quantity twice.

## Atmospheric-domain responsibilities

- Analysis, forecast, reanalysis, observation and climatology source identity.
- Four-dimensional temperature, pressure, humidity, wind and cloud state.
- Aerosol/pollutant species mass or concentration, column diagnostics and available optical diagnostics.
- Native vertical-coordinate semantics and conservative, quality-aware interpolation into runtime chunks.
- Observation/model fusion, distributional climatologies, explicit inferred priors and uncertainty.
- Independent `AtmosphereFieldRelease` manifests, chunks, provenance, licences and conformance fixtures.

It does not perform Mie calculations, molecular spectroscopy, cloud optical closure, phase-function selection or light transport. Those remain Physics responsibilities.

## Emission-domain responsibilities

- Source position and horizontal support.
- Surface elevation reference and source height class when supported.
- Corrected DNB-band upward radiance or its surface-integrated directional intensity.
- Spectral profile reference and uncertainty.
- Upward angular emission profile reference and uncertainty.
- Temporal profile reference and reference time.
- Evidence, `DataValidity`, `CoverageStatus`, censoring, uncertainty and provenance as separate fields.
- Conservative spatial refinement and multi-source fusion.

## Propagation-solver responsibilities

- WGS84/ellipsoidal or validated spherical geometry and Earth screening.
- Select the Physics-owned `SurfaceTerrainProduct`, then reconcile observer
  height, source height, atmosphere terrain masks, terrain horizon and local
  obstruction exactly once under a revisioned policy.
- Convert atmospheric state variables into three-dimensional molecular density and wavelength-dependent aerosol/gas/cloud optical properties.
- Wavelength-dependent extinction, absorption, phase functions, single scattering, and validated multiple-scattering treatment.
- Ground reflection using the `SurfaceTerrainProduct` wavelength-dependent
  BRDF/albedo where enabled.
- Integration over the full source field and sky directions.
- Natural sky components, observation-response products and physically defined photometric bands.

Viewer alone owns exposure/adaptation presentation, tone mapping, gamut/output transfer, palettes and UI composition. Physics may publish a declared physical observer-response basis but does not own the final display transform.

## Atmospheric correction is not propagation

Black Marble estimates upward surface radiance after correcting the satellite observation for the sensor path, clouds, moonlight, terrain, snow, BRDF, and stray light. That correction reconstructs the source-side signal. The future solver must then propagate that surface emission along a new source-to-observer path under the requested atmosphere. It must not reapply the original satellite-path attenuation.

## No fixed source radius in the atlas

The influence distance depends on wavelength, aerosol loading and vertical profile, cloud, source elevation, observer elevation, viewing direction, Earth curvature, and the emission angle. Published modelling notes that curvature matters across hundreds of kilometres, and the 2016 World Atlas describes skyglow visible hundreds of kilometres from sources.

The runtime therefore uses an adaptive termination rule, for example:

1. Enumerate spatial rings/chunks outward from the observer.
2. Bound each ring's maximum possible contribution using its total source intensity and a conservative transfer bound.
3. Stop only when the unprocessed tail is below an absolute and relative error budget in every requested band/direction.
4. Enforce a configurable hard safety ceiling, initially at least the current application's 1,000 km domain until convergence experiments justify less.

100–150 km may become an efficient default for ordinary conditions, but it is not a data cutoff and must be tested against clean-air, high-altitude, and bright-metropolis cases.

## 3-D globe mode

The same separation supports a future globe view:

- The atlas can render measured surface emission directly as a provenance-aware overlay.
- The atmospheric domain can render PM, humidity, aerosol optical depth, cloud or uncertainty layers directly with their own units and time/evidence labels.
- The solver can render atmospheric skyglow volumes or observer-specific hemispheres.
- OSM remains a visual/geometric context layer, not the light field itself.

The UI must label these modes differently: **surface emission**, **modelled atmospheric radiance**, and **display composite** are not interchangeable.

## Normative consumer handoff

The repository-wide vocabulary, validity/evidence axes, version identities, scenario and Wasm lifecycle are defined in the [unified system contract](../../docs/system-contract.md). The emission-specific coordinate/profile meanings are defined in [18-physics-handoff.md](18-physics-handoff.md), and atmospheric meanings in [21-atmosphere-physics-handoff.md](21-atmosphere-physics-handoff.md). The initial emission handoff is `J_DNB [W sr^-1]` plus explicit profile states. A consumer may construct wavelength- and direction-resolved emission only when compatible spectral/angular evidence exists or an explicitly named scenario is selected.

The atlas value is already an outgoing surface-side signal. It may include first reflection of downward lamp light. The propagation solver must not apply the ground BRDF to that initial signal again; only subsequent atmosphere–surface reflection orders belong to downstream transport.

The atmospheric handoff is separate and defined in [21-atmosphere-physics-handoff.md](21-atmosphere-physics-handoff.md). A PM2.5 concentration or 550-nm AOD is not itself a complete visible-wavelength scattering phase function; Physics must use declared composition/optical evidence and uncertainty rather than silently treating either scalar as the full medium.

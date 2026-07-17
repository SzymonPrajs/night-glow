# 02. System boundary

## Two products, one physical chain

```text
public observations                         observer conditions
       │                                             │
       ▼                                             ▼
surface emission atlas ───────────────► 3-D propagation solver
where/how sources emit                    how emitted light reaches the eye
```

The atlas describes boundary conditions at the emitting surface. The solver describes transport through the atmosphere to an observer. Combining them early would make a global dataset valid only for one assumed atmosphere and would risk correcting the atmosphere twice.

## Atlas responsibilities

- Source position and horizontal support.
- Surface elevation reference and source height class when supported.
- Corrected DNB-band upward radiance or its surface-integrated directional intensity.
- Spectral profile reference and uncertainty.
- Upward angular emission profile reference and uncertainty.
- Temporal profile reference and reference time.
- Evidence, quality, censoring, and provenance.
- Conservative spatial refinement and multi-source fusion.

## Propagation-solver responsibilities

- WGS84/ellipsoidal or validated spherical geometry and Earth screening.
- Observer height, source height, terrain horizon, and local obstruction.
- Three-dimensional molecular density, aerosols, ozone, water vapour, clouds, and vertical layers.
- Wavelength-dependent extinction, absorption, phase functions, single scattering, and validated multiple-scattering treatment.
- Ground reflection using wavelength-dependent BRDF/albedo where enabled.
- Integration over the full source field and sky directions.
- Natural sky components, visual adaptation, photometric bands, and display tone mapping.

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
- The solver can render atmospheric skyglow volumes or observer-specific hemispheres.
- OSM remains a visual/geometric context layer, not the light field itself.

The UI must label these modes differently: **surface emission**, **modelled atmospheric radiance**, and **display composite** are not interchangeable.

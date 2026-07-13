# Atmospheric light-glow kernel

This directory converts a polar grid of upward artificial-light power into a
spectral sky-radiance field. It is deliberately independent of OpenStreetMap,
React, and the renderer: the map stage may use any ring widths or sector count
as long as it supplies each ring's midpoint distance.

## Model and units

For a source cell with unit upward spectral power, the first-order radiance in
view direction `v` is evaluated along the curved-Earth sightline:

```text
L1(lambda, v) = integral U(mu_s) / (r_s^2 + r0^2)
                 exp[-tau_lambda(source,x) - tau_lambda(x,observer)]
                 [beta_R p_R + beta_a omega_a p_a + beta_c omega_c p_c] ds
```

`U` is a normalized mixture of a Lambertian upward lobe and a low-elevation
lobe, `r0` is the finite source-cell softening radius, and each phase function
is normalized over `4 pi`. The returned unit is therefore a relative radiance
per unit upward spectral power. Absolute `cd/m2` calibration belongs in the
emission inventory/calibration layer; linearity means it can be applied before
or after this module.

The observer and source lie on a sphere of radius 6371.0088 km. Atmosphere exit
and layer crossings use exact ray/sphere intersections, so the horizon,
Earth-curvature screening, and long paths through high-altitude scatterers are
not represented by a flat-Earth approximation. This is important for the
visible influence of bright cities hundreds of kilometres away.

### Constituents

- Molecular density is exponential with an 8 km default scale height. The
  sea-level Rayleigh vertical optical depth is
  `0.008569 lambda^-4 (1 + 0.0113 lambda^-2 + 0.00013 lambda^-4)`, with
  wavelength in micrometres, pressure scaling, and a depolarization-corrected
  Rayleigh phase function.
- The AOD input is a dry/reference-humidity baseline. Ambient aerosol optical depth follows the Angstrom law
  `tau_a(lambda) = tau_a(550) (lambda / 550 nm)^(-alpha)` and an exponential
  vertical profile. Hygroscopic growth uses the capped Hanel factor
  `[(1-RH_ref)/(1-RH)]^gamma`. A two-lobe Henyey-Greenstein phase function
  preserves a small but important aerosol backscatter component.
- A fractional cloud layer is a horizontally uniform unresolved mean column.
  It contributes extinction and scattering along the exact path through its
  spherical shell, but it is not patchy 3-D cloud geometry. Its phase function
  combines a forward HG lobe with an isotropic internal-scattering term.
  Ground albedo is used only by a bounded empirical cloud-to-ground feedback;
  there is no clear-sky surface-reflection path.

The two-leg optical-depth columns are integrated independently from source to
scatterer and scatterer to observer. Quadrature is concentrated near the
ground so a roughly 1 km aerosol layer remains resolved on shallow paths many
hundreds of kilometres long.

### Multiple scattering

Successive orders use the reduced transport approximation
`Ln = rho L(n-1)`. Higher orders are scalar amplification of the first-order
sightline and retain its angular shape; they are not spatially reintegrated.
`rho` is inferred from contribution-weighted transport
optical depth (including `1-g` for forward scattering), augmented by the
cloud/ground loop, and strictly clamped below one. The Neumann series is thus
convergent. It stops at a relative tolerance; if the configured order limit is
hit first, the remaining geometric tail can be closed analytically. All public
radiances are finite and non-negative.

This is a fast physically based relative-glow model, not a line-by-line Monte
Carlo radiative-transfer solver. Rays are straight and unrefracted. It
intentionally omits terrain occlusion, resolved 3-D clouds, vertical
temperature profiles, polarization, ozone absorption, and wavelength structure
inside a band. Each band is evaluated only at its centre wavelength. Downstream
RGB, SQM, Bortle, and limiting-magnitude mappings are heuristic, not calibrated
photometry.

## Kernel precomputation and caching

`buildAtmosphericKernel` tabulates unit-source response over distance, relative
azimuth, elevation, and the eight shared spectral bands. The default distance
grid reaches 1000 km and the relative-azimuth response is sampled every five
degrees. Lookups use trilinear interpolation and azimuthal symmetry.

`atmosphericKernelCacheKey` hashes all atmosphere, grid, band, and transfer
settings. `serializeAtmosphericKernel` and `deserializeAtmosphericKernel` allow
the result to be persisted in IndexedDB or transferred from a worker. The
builder's `onProgress(completed, total)` callback is suitable for the analysis
progress bar.

For repeated map updates, call `createRingConvolutionPlan` once per kernel,
ring layout, sector count, and elevation list. It precomputes the circular
kernel as a truncated real Fourier series. With a five-degree kernel the plan
uses at most 36 angular harmonics even when the map uses 720 half-degree
sectors. `ringConvolutionPlanCacheKey` can be computed before building it.

The fast convolution scales as:

```text
O(rings * bands * harmonics * sectors
  + elevations * bands * harmonics * (rings + sectors))
```

rather than direct `O(elevations * rings * bands * sectors^2)` summation.
The five-degree kernel resolves at most 36 harmonics; 720 bearings are smooth
half-degree output samples rather than independent half-degree atmospheric
resolution. Small negative Fourier ringing is clipped to zero.

## Minimal use

```ts
import {
  buildAtmosphericKernel,
  convolveRingEmissionField,
  createRingConvolutionPlan,
  createRingEmissionField,
} from './lib/physics'

const kernel = buildAtmosphericKernel({
  aerosolOpticalDepth550: 0.16,
  relativeHumidity: 0.8,
  cloud: { coverage: 0.15, opticalDepth: 4 },
})

// `emissionValues` is [ring][sector][band], for example the map module's
// Float64Array. Ring distances are the actual ring midpoints.
const field = createRingEmissionField(
  ringMidpointsKm,
  720,
  kernel.bands.map((band) => band.id),
  emissionValues,
  0.25, // bearing of sector zero's centre
)
const elevations = [0, 2, 5, 10, 20, 30, 45, 60, 75, 90]
const plan = createRingConvolutionPlan(kernel, ringMidpointsKm, 720, elevations)
const sky = convolveRingEmissionField(kernel, field, elevations, plan)
```

`sky.radiance` is laid out as `[elevation][azimuth sector][band]`. Inputs are
validated rather than silently accepting negative or non-finite power, and the
same normalized inputs always produce the same kernel and cache keys.

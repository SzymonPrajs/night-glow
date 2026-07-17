# Physics model

## 1. Quantity being solved

The primary field is spectral radiance

\[
L_\lambda(\mathbf{x},\hat{\mathbf{n}},t)
\quad [\mathrm{W\,m^{-2}\,sr^{-1}\,nm^{-1}}],
\]

at position \(\mathbf{x}\), propagation direction \(\hat{\mathbf{n}}\), wavelength \(\lambda\), and time \(t\). Band-integrated radiance is produced only through a declared response/integration operator. RGB is not an internal transport quantity.

The steady-state scalar radiative-transfer equation along path length \(s\) is conceptually

\[
\frac{dL_\lambda}{ds}
=-\beta_{\mathrm{ext},\lambda} L_\lambda
+j_{\mathrm{em},\lambda}
+\beta_{\mathrm{sca},\lambda}
\int_{4\pi} P_\lambda(\hat{\mathbf{n}}'\!\to\!\hat{\mathbf{n}})
L_\lambda(\hat{\mathbf{n}}')\,d\Omega'.
\]

The implemented representation may use layers, discrete ordinates, Monte Carlo packets, successive orders, or a precomputed operator, but it must preserve these meanings and state its approximations. Polarization would replace scalar radiance/phase function with Stokes vectors and phase matrices; whether that is in the first scientific scope is an open decision.

## 2. Scene state

The scene state has four categories:

1. **Geometry:** oblate/spherical Earth basis, observer, terrain, atmosphere shells/voxels, source directions/disks, surface intersections.
2. **Environmental state and optical medium:** a provenance-bearing four-dimensional meteorological/aerosol/cloud state, then Physics-derived molecular absorption/scattering, aerosol/cloud optics, and refractive index with vertical/horizontal/time dependence.
3. **Boundary/source radiance:** Sun, Moon, planets, resolved stars, diffuse celestial fields, airglow, and artificial upward emission.
4. **Observation:** atmospheric/optical PSF, aperture and declared sensor/eye spectral response. Viewer-owned exposure, tone mapping and display transforms are downstream and are not scene state.

Observation is downstream. Exposure or bloom must never alter optical depth or source power.

## 3. Transfer decomposition

For an optical/surface state \(m\), define a transfer operator \(\mathcal{T}_m\) that maps boundary and volume sources to observer radiance. When the chosen model is linear in radiance for fixed \(m\),

\[
L_{\mathrm{obs}}
=\mathcal{T}_m\!\left[
S_\odot+S_\mathrm{Moon}+S_\mathrm{planets}+S_\mathrm{stars}
+S_\mathrm{diffuse}+S_\mathrm{airglow}+S_\mathrm{artificial}
\right].
\]

This allows reuse and parallel source evaluation. It does **not** allow adding separately tone-mapped layers, or reusing a transfer table after clouds/aerosols/surface state has changed.

Useful diagnostic decomposition retains:

- direct transmitted source radiance;
- single-scattered radiance by source/component;
- higher scattering orders or their converged aggregate;
- surface-reflected contributions by reflection order;
- emission produced within the medium;
- numerical residual and truncated-domain loss.

## 4. Molecular atmosphere

The input state comes from an exact Environment Atlas atmospheric release and evidence selection, or from an explicitly labelled standard profile. It must retain pressure/temperature/composition, humidity, vertical coordinate, spatial/time support, uncertainty and missingness. The query covers the propagation volume between emitters and observer; a single local weather column is insufficient for horizontally heterogeneous city plumes and clouds.

Physics reconstructs hydrostatically consistent layer geometry and number density at actual observer altitude. Molecular number density drives Rayleigh scattering; absorption must be band-integrated from an accepted spectral model rather than a decorative colour coefficient. Ozone is important in visible twilight bands, while oxygen/water features matter depending on band placement and desired spectral accuracy.

The current eight wavelengths (420, 450, 480, 510, 550, 589, 625, and 680 nm) are a useful migration fixture, not a final proof of spectral convergence. Narrow artificial-light lines and atmospheric bands require an error-driven basis or preintegrated coefficients.

## 5. Aerosols and clouds

Aerosols require wavelength-dependent extinction, single-scattering albedo, and a normalized angular phase representation. Strong forward lobes must be treated without under-sampling or violating conservation. Relative humidity can change both size and optics, so “humidity” cannot be only a display control. Species/size-bin mass and dry-state properties permit a Physics-owned hygroscopic closure; provider extinction/AOD/SSA/asymmetry may constrain or validate it only when wavelength and ambient-wet/dry meaning are explicit. The adapter must never wet already ambient-wet provider optics a second time.

Clouds require separate liquid/ice optical properties, altitude and geometrical/coverage state. They can dim direct celestial sources while greatly amplifying artificial light or moonlight through scattering and reflection. The model must therefore solve both transmission and source redistribution.

PM2.5, PM10, total AOD and reported visibility are valuable constraints but cannot by themselves determine vertical distribution, composition, wavelength dependence, absorption or phase function. Missing values never mean clean air. When the release lacks closure inputs, Physics returns an uncertainty-bound/scenario result rather than inventing an exact atmosphere.

## 6. Refraction and horizon density

Refraction changes apparent direction and the density/path length sampled near the horizon. For high-quality horizon results, rays should be integrated through a spherical refractive-index profile. The resulting curved path must be usable by radiative transfer, not merely applied as a vertex displacement.

Near the horizon, accuracy must be controlled in optical-depth/path coordinates, because small angular errors can cross terrain or enter very long dense-air paths. Differential chromatic refraction also broadens or separates spectral point-source images.

## 7. Surface and terrain coupling

At a surface point, outgoing radiance is conceptually

\[
L_{o,\lambda}(\hat{\mathbf{n}}_o)
=L_{e,\lambda}(\hat{\mathbf{n}}_o)
+\int_{\Omega^+} f_{r,\lambda}(\hat{\mathbf{n}}_i,\hat{\mathbf{n}}_o)
L_{i,\lambda}(\hat{\mathbf{n}}_i)
(\hat{\mathbf{n}}_i\cdot\hat{\mathbf{n}}_s)\,d\Omega_i.
\]

The BRDF \(f_r\) must conserve energy. Land, water, snow/ice, and urban surfaces need distinct models or declared mixtures. Terrain determines visibility, shadowing, local normals, and whether a path intersects the ground. Repeated atmosphere–surface reflection orders are included until a declared residual tolerance or justified approximation.

## 8. Artificial-light path

The complete chain has an explicit project boundary:

```text
satellite/inventory/geometry evidence
  -> Environment Atlas emission domain correction, fusion, conservative refinement
  -> J_DNB [W sr^-1] + corrected reference view
     + resolved/unresolved spectrum/angle/time + uncertainty/provenance
  ---------------- independent product boundary ----------------
  -> Physics compatibility checks and explicit source policy
  -> wavelength/direction/time-resolved outgoing boundary source
  -> terrain/surface visibility and first bounce
  -> atmospheric propagation and multiple scattering
  -> observer spectral radiance
```

Environment Atlas emission domain owns the satellite/source inversion, including view correction, clouds, moonlight, snow, sensor response, saturation, temporal sampling, spatial allocation, and source evidence. Physics does not redo it. The baseline handoff is surface-integrated DNB-response directional intensity for a declared corrected reference view—not total upward flux or a spectrum.

Physics constructs a unique spectral/angular source only when the atlas supplies compatible resolved profiles or the caller explicitly chooses a named scenario. Unresolved spectrum/angle/time stays unresolved; no typical city spectrum, Lambertian `pi L`, current eight-band distribution, or constant-night assumption is silently presented as measured.

The atlas value is an outgoing surface-side signal and can already combine direct upward emission with downward lamp light reflected upward. Physics does not apply the ground BRDF to that initial value again. Subsequent atmosphere-to-ground-to-atmosphere reflection is a new transport order and remains part of the solver. Full details are in [the Environment Atlas emission domain consumer contract](contracts/EMISSION_RELEASE_CONTRACT.md).

## 9. Sun and twilight

The Sun is a finite disk with a calibrated top-of-atmosphere spectrum and distance dependence. Twilight requires spherical geometry, long refracted paths, ozone/aerosol effects, terrain shadowing, and multiple scattering. A daylight sky shader is not an adequate reference for nautical/astronomical twilight if absolute night-sky radiance is the goal.

## 10. Moon and earthshine

Moonlight is not “sunlight times illuminated fraction.” The source depends on Sun–Moon–observer geometry, lunar orientation/libration, wavelength-dependent photometric function, opposition effect, albedo/topography, distance, eclipses, and earthshine.

Earthshine is a coupled but bounded path:

```text
Sun -> spatial Earth atmosphere/cloud/surface reflection -> Moon
    -> lunar reflection -> Earth atmosphere -> observer
```

The model must enumerate retained orders. A first version may use a validated disk-integrated Earth reflectance, but the architecture supports mapped surface/cloud states. Other planets’ illumination of the Moon should not be promoted into the main solve unless a quantitative bound shows it is non-negligible.

## 11. Planets, stars, and the Milky Way

Astronomy supplies apparent locations, phase geometry, distances, and angular sizes. Physical source modules then supply top-of-atmosphere radiance/flux.

Resolved stars use catalogue photometry/spectra, variability, interstellar extinction policy, and flux-conserving LOD. Their atmospheric attenuation and PSF are wavelength/direction dependent.

The diffuse celestial field is component-separated:

- unresolved integrated starlight;
- diffuse Galactic light scattered by dust;
- nebular/line emission;
- zodiacal light;
- airglow (an atmospheric volume source, despite being displayed as “sky”);
- extragalactic background if relevant.

A high-resolution colour map may guide validation, but runtime data must have absolute radiance calibration, known survey PSF, spectral mapping, provenance, and resolved-star subtraction. A point-source PSF is not applied indiscriminately to already diffuse radiance.

## 12. PSF and final observation

For a locally shift-invariant point-source patch,

\[
L_{\mathrm{image},\lambda}(\boldsymbol\theta)
=\int K_\lambda(\boldsymbol\theta,\boldsymbol\theta')
L_{\mathrm{arrival},\lambda}(\boldsymbol\theta')\,d\Omega',
\qquad \int K_\lambda\,d\Omega=1.
\]

Wide all-sky fields are generally spatially variant, especially near the horizon. Atmospheric seeing, diffraction, aberrations, pixel/retinal response, scattering glare, and aesthetic bloom are separate components with separate normalization/physical interpretation. The existing Gaussian seeing kernel is the parity baseline; it is not the endpoint.

## 13. Approximation disclosure

Every output reports the fidelity profile and material omissions: polarization, horizontal atmosphere heterogeneity, broken-cloud 3D transport, high scattering orders, fine spectral lines, terrain resolution, stellar completeness, diffuse-map calibration, earthshine order, and PSF components. The renderer may show a quality indicator but must not silently label an interpolated or unconverged field “high resolution.”

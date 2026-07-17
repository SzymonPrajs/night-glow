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
2. **Optical medium:** molecular absorption/scattering, aerosols, clouds, refractive index, and their vertical/horizontal/time dependence.
3. **Boundary/source radiance:** Sun, Moon, planets, resolved stars, diffuse celestial fields, airglow, and artificial upward emission.
4. **Observation:** atmospheric/optical PSF, aperture/sensor/eye response, exposure, and display transform.

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

The reference state should be a pressure/temperature/composition profile consistent with hydrostatic structure and actual observer altitude. Molecular number density drives Rayleigh scattering; absorption must be band-integrated from an accepted spectral model rather than a decorative colour coefficient. Ozone is important in visible twilight bands, while oxygen/water features matter depending on band placement and desired spectral accuracy.

The current eight wavelengths (420, 450, 480, 510, 550, 589, 625, and 680 nm) are a useful migration fixture, not a final proof of spectral convergence. Narrow artificial-light lines and atmospheric bands require an error-driven basis or preintegrated coefficients.

## 5. Aerosols and clouds

Aerosols require wavelength-dependent extinction, single-scattering albedo, and a normalized angular phase representation. Strong forward lobes must be treated without under-sampling or violating conservation. Relative humidity can change both size and optics, so “humidity” cannot be only a display control.

Clouds require separate liquid/ice optical properties, altitude and geometrical/coverage state. They can dim direct celestial sources while greatly amplifying artificial light or moonlight through scattering and reflection. The model must therefore solve both transmission and source redistribution.

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

The desired chain is:

```text
satellite/inventory/geometry evidence
  -> inferred upward source power + spectrum + angular distribution + uncertainty
  -> terrain/surface visibility and first bounce
  -> atmospheric propagation and multiple scattering
  -> observer spectral radiance
```

Satellite DNB radiance is an observation after propagation and viewing geometry, not the source itself. Inversion must handle clouds, moonlight, snow, atmospheric attenuation, sensor response, saturation, temporal sampling, and downward light reflected upward. Where evidence cannot separate these effects, the output must carry uncertainty/model class rather than false precision.

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

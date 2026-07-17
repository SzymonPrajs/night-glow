# Physical night-glow model

This document describes the implemented model, not a proposed future model. The pipeline is deliberately linear in emitted light so that a city’s total proxy flux can be spread over its full width without gaining energy, then propagated through one reusable atmosphere:

```text
bundled extended regional settlement footprints
                         ↓ conserved geometry integration
81 distance rings × 720 bearings × 8 wavelength bands
                         ↓ curved-Earth spectral transfer kernel
positive zero-padded FFT circular convolution
                         ↓
22 adaptive elevations × 720 bearings × spectrum, RGB, and limiting magnitude
                         ↓
3-D glow mesh + directional stars, Milky Way, planets, and deep sky
```

All geographical distances are kilometres. Bearings are clockwise from north. Emission is a central-Poland-calibrated relative radiant-flux proxy rather than calibrated watts. The spatial and radiative-transfer calculations are quantitative relative to the supplied inventory, while SQM, Bortle, RGB, and naked-eye values remain model indices rather than predictive photometry.

## 1. Conserved spectral source grid

The source inventory stores eight bands centred at 420, 450, 480, 510, 550, 589, 625, and 680 nm. For accepted source \(s\), let \(\Phi_{sb}\) be its flux in band \(b\). Extended geometry is represented by positive quadrature weights \(w_{sq}\), normalized as

\[
\alpha_{sq}=\frac{w_{sq}}{\sum_q w_{sq}}.
\]

For observer-centred ring \(j\), azimuth sector \(k\), and band \(b\), deposited flux is

\[
G_{jkb}=\sum_s\sum_q
\mathbf 1[r_{sq}\in R_j]\,
\mathbf 1[\theta_{sq}\in\Theta_k]\,
\alpha_{sq}\Phi_{sb}.
\]

The angular step is \(0.5^\circ\). Cell centres are at 0.25°, 0.75°, and so on; each quadrature sample is conservatively split between its adjacent centres. This removes a hard sector-boundary jump while preserving bandwise flux. The radial grid is fine near the observer, where a small distance change matters most, and deliberately coarse in the distant tail:

| Range | Ring width | Rings |
|---:|---:|---:|
| 0–1 km | 0.25 km | 4 |
| 1–5 km | 0.5 km | 8 |
| 5–20 km | 1 km | 15 |
| 20–50 km | 2 km | 15 |
| 50–100 km | 5 km | 10 |
| 100–200 km | 10 km | 10 |
| 200–300 km | 20 km | 5 |
| 300–1000 km | 50 km | 14 |

That is 67 detailed rings through 300 km and 14 tail rings through 1000 km. Samples beyond 1000 km are not renormalized into nearer rings. They enter an outside-domain ledger, so independently for every band

\[
\Phi_{sb}=\sum_{jk}G^{(s)}_{jkb}+\Phi^{\mathrm{outside}}_{sb}
\]

up to floating-point rounding.

### Extended geometry integration

- Settlement ellipses use deterministic equal-area Hammersley samples. A city therefore occupies many angular and radial cells rather than collapsing to one centroid.

The default spacing is 0.5 km with a maximum of 4096 samples per source. The weight normalization makes the grid an integral of a uniformly emissive footprint, not a collection of independent point lights.

## 2. Regional settlement totals

For bundled settlement \(p\), first define an equivalent lit area

\[
E_p=0.72A_p+0.28\frac{P_p}{3200},
\]

where \(A_p\) is proxy built area in km² and \(P_p\) is proxy population. The calibrated relative upward-flux total is

\[
\Phi_p=11.5\,I_p E_p\left(\frac{E_p}{100\ \mathrm{km^2}}\right)^{0.30}.
\]

Here \(I_p\) is a lighting-intensity factor. The 1.30 total exponent captures the observed super-linear growth between small settlements and the much brighter cores of Łódź and Warsaw; it does not assert a universal urban scaling law. A purely linear multiplier can match rural central Poland or the large-city centres, but not both simultaneously.

The two free scale terms were fitted under the **Typical clear** atmosphere (AOD 0.14, relative humidity 0.50, no cloud) to four zenith anchors from the 2015 World Atlas clear-sky model. `npm run test:calibration` independently rebuilds the full source grid and transfer field at every site:

| Observer | Atlas anchor | Predicted | Error |
|---|---:|---:|---:|
| Zapolice | 21.279 | 21.173 | -0.106 mag |
| Łowicz | 20.477 | 20.387 | -0.090 mag |
| Łódź centre | 18.096 | 18.246 | +0.150 mag |
| Warsaw centre | 17.551 | 17.437 | -0.114 mag |

The RMS error is 0.117 mag and the largest error is 0.150 mag. These anchors are appropriate for spatial calibration, but they are not local measurements at the exact date and weather selected in the app. As an independent reality check, the long-term Warsaw survey reported a darkest cloudless/moonless astronomical zenith of 18.65 ± 0.06 mag/arcsec² at its monitoring site and a 17.16 median across astronomical-night weather. This difference is expected: the app's Warsaw anchor is the brighter city centre, while real nights vary strongly with site, cloud, aerosol, snow, lighting, and time.

Sources: [World Atlas paper](https://doi.org/10.1126/sciadv.1600377), [World Atlas dataset](https://doi.org/10.5880/GFZ.1.4.2016.001), [Warsaw long-term survey](https://doi.org/10.1016/j.jqsrt.2019.06.024).

The default mixed sodium/white-LED band fractions are

\[
(0.055,0.090,0.115,0.145,0.170,0.210,0.130,0.085).
\]

This total is initially uniform over the settlement ellipse. For Łódź, for example, the ellipse has 13 km and 9.5 km semi-axes rather than one coordinate at the city centre.

## 3. Curved-Earth single scattering

The observer and every source lie on a sphere of IUGG mean radius \(R_\oplus=6371.0088\) km. A view ray exits the spherical atmosphere at an exact ray/sphere intersection. Source-to-scatter and scatter-to-observer columns are integrated independently, and a source contributes only when its local upward-emission cosine is positive. This provides Earth-curvature screening while retaining light that reaches high-altitude scatterers hundreds of kilometres away.

For one unit of upward spectral power, first-order radiance in view direction \(\hat v\) is

\[
L^{(1)}_\lambda(\hat v)=
\int_0^{s_{\rm top}}
\frac{U(\mu_s)}{r_s^2+r_0^2}
\exp[-\tau_\lambda(s\rightarrow x)-\tau_\lambda(x\rightarrow o)]
\left[
\beta_R p_R+\beta_a\omega_a p_a+\beta_c\omega_c p_c
\right]\,d\ell.
\]

Here \(r_0\) is a finite-source softening radius, the phase functions integrate to one over \(4\pi\), and the normalized upward intensity is a configurable mixture

\[
U(\mu)=f_L\frac{\mu}{\pi}+
(1-f_L)\frac{(n+1)(1-\mu)^n}{2\pi},\qquad \mu>0.
\]

The first term is Lambertian; the second represents low-elevation upward leakage. The line integral uses altitude breakpoints plus Gaussian quadrature, with denser resolution near the ground and source projection. Optical-depth columns use a transformed ten-point quadrature that concentrates nodes near the low-altitude endpoint.

### Molecular scattering

Molecular density is exponential with an 8 km default scale height. Sea-level Rayleigh vertical optical depth is

\[
\tau_R(\lambda)=0.008569\lambda^{-4}
\left(1+0.0113\lambda^{-2}+0.00013\lambda^{-4}\right)
\frac{p}{p_0},
\]

with wavelength in micrometres. The implementation uses a depolarization-corrected Rayleigh phase function.

### Aerosol and humidity

The AOD control is a dry/reference-humidity baseline. Ambient aerosol optical depth follows the Ångström law after hygroscopic growth:

\[
\tau_a(\lambda)=\tau_a(550)
\left(\frac{\lambda}{550\ \mathrm{nm}}\right)^{-\alpha}g_{\rm RH},
\]

with capped Hänel hygroscopic growth

\[
g_{\rm RH}=\min\left[8,
\left(\frac{1-RH_{\rm ref}}{1-RH}\right)^\gamma\right].
\]

Aerosol density is exponential with a user-controlled scale height. Scattering uses single-scatter albedo and a two-lobe Henyey–Greenstein phase function: a dominant forward lobe plus a small backward lobe so that distant backscatter is not artificially removed.

### Cloud and surface loop

Cloud cover is a horizontally uniform unresolved mean column through a spherical shell, effectively coverage multiplied into its extinction/scattering column. It is not patchy 3-D cloud geometry. The phase function mixes a forward HG lobe with an isotropic internal-scattering term. Low cloud can therefore return more urban light, while a thick intervening cloud also extinguishes distant light. Ground albedo appears only in the empirical cloud/ground feedback; there is no clear-sky surface-reflection path.

The reduced unit-source geometry misses part of the broad city-to-deck-to-ground return measured over polluted cities. A bounded empirical closure therefore multiplies only the final artificial-light radiance:

\[
F_{\rm low\ cloud}=1+0.8C\left(1-e^{-\tau_c/3}\right)e^{-h_b/(2\ {\rm km})},
\qquad 1\le F_{\rm low\ cloud}\le1.8,
\]

where \(h_b\) is cloud-base altitude. The term is exactly one in clear air, rises monotonically with cover and optical depth, and decays rapidly with cloud height. It leaves first-order diagnostics, the multiple-scattering continuation, natural sky, and direct celestial transmission unchanged. On the exact shipped worker grid at Warsaw centre, Typical clear is 17.437 SQM; Low overcast is 15.308 SQM (7.10× total brightness) and Snow overcast is 15.100 SQM (8.61×). This intentionally matches the observed order of polluted-site overcast amplification—about 7× in the long-term Warsaw survey and commonly 6–10× in the Poland report—without assigning an implausible ground albedo to the ordinary low-overcast case. It remains a regional empirical closure, not resolved 3-D cloud transport. Sources: [Warsaw survey](https://doi.org/10.1016/j.jqsrt.2019.06.024), [Light Pollution in Poland report](https://lptt.org.pl/zasoby/lptt_report_2023_eng.pdf).

The same unresolved-cover interpretation now attenuates direct celestial objects. For cloud fraction \(C\), optical depth \(\tau_c\), and relative air mass \(X(h)\) at object altitude \(h\),

\[
T_{\rm direct}(h)=(1-C)+C\exp[-\tau_c X(h)],\qquad
A_{\rm cloud}(h)=-2.5\log_{10}T_{\rm direct}(h).
\]

This extinction is applied consistently to stars, visible-star counts, the summary limit, the Milky Way, deep-sky objects, planets, Moon, and Sun. It increases toward the horizon. Fully opaque overcast therefore removes direct stars instead of displaying thousands of catalogue objects on top of a bright cloud deck; broken cloud retains the unresolved clear fraction.

### Shipped weather scenarios

The preset gallery changes physical atmosphere inputs, never numerical accuracy: all eight presets use four explicit scattering orders and the same bounded tail closure.

| Preset | Intended central-European scenario |
|---|---|
| Crisp clear | AOD 0.04, dry air, exceptional transparency |
| Typical clear | AOD 0.14, 50% RH, cloudless regional baseline |
| Humid | Moist air with a small low-cloud fraction |
| Winter smog | AOD 0.40 in a shallow fine-aerosol inversion |
| Thin cirrus | 65% high veil with optical depth 0.25 |
| Broken low cloud | 55% cover, 1 km base, optical depth 6 |
| Low overcast | Fully covered 0.8 km deck, optical depth 15 |
| Snow overcast | The same opaque low deck over 0.65 ground albedo |

Poland-wide aerosol studies place long-term mean AOD550 around 0.14–0.17, which motivates the Typical clear reference; individual episodes can be far cleaner or much more polluted. Cirrus optical depth below about 0.3 motivates the thin-veil scenario. The cloud presets are controlled sensitivity cases rather than forecasts or claims of one universal cloud response. Sources: [Poland AOD climatology](https://doi.org/10.3390/atmos12121583), [thin-cirrus optical depth study](https://doi.org/10.5194/amt-17-1197-2024).

## 4. Bounded multiple scattering

The model uses a reduced successive-orders approximation rather than a Monte Carlo solver:

\[
L^{(n)}_\lambda=\rho_\lambda L^{(n-1)}_\lambda.
\]

The continuation \(\rho_\lambda\) is derived from contribution-weighted transport optical depth (including \(1-g\) for forward-scattering media) and the cloud/ground loop. It is capped at 0.92, so the Neumann series is convergent:

\[
L_\lambda=L^{(1)}_\lambda\sum_{n=0}^{\infty}\rho_\lambda^n.
\]

Higher orders are a scalar amplification of the first-order sightline and therefore retain its angular shape; they are not spatially or angularly reintegrated. The configured “explicit scatter orders” controls how many terms are stepped before the remaining geometric tail is closed analytically as \(L_N\rho/(1-\rho)\). Public outputs are clamped to finite, non-negative values and diagnostics count any invalid result.

## 5. Kernel and fast angular convolution

Atmospheric state changes much less often than view direction. The worker therefore tabulates a unit-source kernel

\[
K_b(r,e,\Delta\theta)
\]

over distance, elevation, relative azimuth, and wavelength. Each spectral band is evaluated at its centre wavelength; nominal band widths are not numerically integrated. Relative azimuth is symmetric and adapts from 0.5° steps through the forward-scattering core (0–10°), to 1° through 20°, 2.5° through 30°, and 5° beyond. Distance nodes reach the outer 1000 km ring. Trilinear interpolation supplies intermediate values.

The elevation grid is also nonuniform, because the long near-ground optical path makes radiance bend much more sharply just above the horizon than near the zenith:

| Elevation range | Maximum solved step |
|---:|---:|
| 0–0.25° | 0.125° |
| 0.25–3° | 0.5° |
| 3–8° | 1° |
| 8–20° | 5° |
| 20–90° | 15° |

The exact 22 nodes are \(0,0.125,0.25,0.5,1,1.5,2,2.5,3,4,5,6,7,8,10,15,20,30,45,60,75,90^\circ\). They are observer-centred and independent of camera pan, zoom, and field of view. A view-dependent kernel would invalidate the atmosphere and FFT caches during every drag, causing multi-second recomputation and temporal popping.

Against direct transfer evaluations every 0.125° through 10°, over 15 representative distance/relative-azimuth cases and all eight bands, linear interpolation on this grid has 0.62% normalized RMS error, 0.88% p95 error, and 9.71% worst-case error. The former 11-row grid measured 7.56%, 17.61%, and 52.38% respectively.

The spectral sky is the circular convolution

\[
L_{ekb}=\sum_j\sum_m G_{jmb}\,
K_b(r_j,e,\theta_k-\theta_m).
\]

A direct evaluation would scale as \(O(ERBN^2)\). Instead, each non-negative angular kernel is sampled onto the 720-bearing output grid, zero-padded to a 2048-point linear-convolution FFT, and cached as a real half-spectrum. Every source ring is transformed once; its spectrum is multiplied by each ring kernel and the wrapped linear-convolution tail is folded back onto the circle. If \(F\) is the FFT size, cached sky-solve complexity is

\[
O\!\left(RBF\log F+EB\left(RF+F\log F\right)\right),
\]

where \(R\) is rings, \(B\) bands, \(E\) elevations, and \(N\) bearings. There is no low-harmonic truncation. Both source power and sampled kernels are non-negative, so this construction cannot create detached Gibbs side lobes; only round-off-sized negative values are clamped. Angular-mean conservation is checked numerically.

Kernel keys hash an explicit numerical-model revision together with atmosphere, transfer options, bands, and sampling grid. The revision must be bumped whenever kernel-producing maths changes and is included in preset-asset URLs, preventing a same-sized binary from a previous deployment being accepted from the HTTP cache. Plan keys additionally hash ring layout, elevation list, and sector count. Exact repeats reuse both. Each shipped weather preset has a generated 183,040-value Float32 kernel (715 KiB); the eight lazy assets total 5.59 MiB. `npm run precompute:weather` rebuilds them in parallel from the same audited TypeScript transfer code. Assets are length-checked and finite/non-negative-tested before use; a missing or invalid asset falls back to the live solver. Custom settings always use that live path. The 720-bearing FFT plan is 111.5 MiB, remains a runtime cache, and is limited to one active atmosphere so replacement cannot briefly double its memory.

Aggregate distance, source-layer, and field diagnostics do not average the 22 rows equally. With \(u_i=\sin(e_i)\), normalized trapezoid weights are

\[
w_0=\frac{u_1-u_0}{2},\qquad
w_i=\frac{u_{i+1}-u_{i-1}}{2},\qquad
w_{E-1}=\frac{u_{E-1}-u_{E-2}}{2}.
\]

They sum to one because the grid spans 0–90°. This is the correct hemisphere measure \(d\Omega=\cos(e)\,de\,d\theta=du\,d\theta\), and prevents dense horizon sampling from changing a mean merely by adding rows.

## 6. From spectral sky to visible objects

The worker outputs the full eight-band radiance plus an approximate linear-RGB projection. The default RGB matrix uses smooth wavelength response curves; it is intended for display and is not a CIE-calibrated colorimeter.

At each elevation and bearing the artificial RGB luminance \(Y_{\rm art}\) changes the local naked-eye limit as

\[
m_{\rm lim}=\operatorname{clamp}\left[
m_{\rm dark}-1.18\log_{10}\left(1+\frac{Y_{\rm art}}{Y_{\rm natural}}\right),
0,m_{\rm dark}
\right].
\]

The renderer bilinearly interpolates the periodic bearing grid and irregular elevation grid. This local limit controls each catalogue star, bright-star label, cluster, nebula, galaxy, planet, and Milky Way sample. The 8,404-star catalogue reaches visual magnitude 6.5; magnitude, B−V colour, spectral type, atmospheric extinction, PSF width, halo, and chromatic dispersion determine each stellar point. Moonlight and astronomical twilight apply an additional global penalty, while the directional artificial-light field remains spatially resolved.

The glow itself is a 720-bearing vertex-colour mesh on the sky dome. The 22 physically solved elevations are linearly densified to 128 render rows, retaining every solved row while limiting render-only steps to 0.25° below 10°, 0.5° through 30°, 1° through 60°, and 2° toward the zenith. This suppresses triangle seams without pretending that interpolation is a new physical solve. A monotonic exposure mapping converts relative radiance to display intensity without replacing the underlying field used for visibility decisions.

### 6.1 Continuous Realistic to Enhanced presentation

Presentation is one normalized scalar

\[
e=\operatorname{clamp}(e_{\rm input},0,1),
\]

where non-finite or malformed input falls back to zero. **Realistic** is the default endpoint at \(e=0\); **Enhanced** is the inspection-oriented endpoint at \(e=1\); values between them interpolate continuously. The endpoint profile anchors are:

| Presentation value | Stellar display gain | Milky Way opacity | Deep-sky opacity | Planet opacity |
|---:|---:|---:|---:|---:|
| Realistic, \(e=0\) | 1.60 | 0.045 | 0.16 | 0.62 |
| Enhanced, \(e=1\) | 1.00 | 0.24 | 1.00 | 1.00 |

Every intermediate profile value is a finite linear interpolation between these anchors. Star colour, signal, CSS-pixel size, core width, halo width, halo strength, and dispersion likewise interpolate between separately computed endpoint visuals.

The separation from physics is strict, not approximate. The worker request and returned spectral/RGB field, directional and summary limiting magnitudes, SQM/Bortle and other metrics, solver timings and progress, cloud extinction, apparent object magnitudes, physical visibility fades, eligibility thresholds, eligible object set, and visible-star count are invariant for all \(e\). Presentation is not allowed to make an otherwise ineligible star, Milky Way sample, deep-sky object, or planet eligible. It only changes the rendering of objects already admitted by the shared physical calculation.

The renderer architecture keeps the Realistic and Enhanced endpoint attributes, textures, geometry, and materials stable on the GPU. Slider movement is intended to update interpolation uniforms only: it must not start a worker request, recompute metrics or eligibility, rebuild endpoint geometry/materials, or recreate the canvas. Physical-input, time, location, and camera changes may still update the resources they genuinely affect. In particular, each star stores one shared apparent magnitude and visibility fade alongside both visual endpoints. Realistic atmospheric dispersion remains angular in arcseconds and is converted with the live camera's CSS-pixels-per-arcsecond scale; Enhanced dispersion is already in CSS pixels. Those two values are converted to the same unit before interpolation.

The persistent setting is `night-glow:sky-enhancement`. On first load, the legacy binary `night-glow:appearance-mode` value migrates as `realistic` → 0 and `atlas` → 1, after which the legacy key is removed. Missing or malformed values resolve to Realistic. “Atlas” therefore survives only as a migration alias for the Enhanced endpoint, not as a current binary mode.

The Realistic endpoint combines natural sky, astronomical twilight, moonlight, and artificial radiance before applying one relative eye/display response. With total luminance \(Y\) and natural reference \(Y_0=0.0020016\), the linear SDR target is

\[
Y_{\rm display}=\min\left[0.55,\;0.006\left(\frac{Y}{Y_0}\right)^{0.22}\right].
\]

The exponent is a relative dark-to-mesopic presentation curve for an uncalibrated monitor, not an absolute display calibration. Astronomical twilight begins continuously at solar altitude \(-18^\circ\) and follows anchored clear-sky zenith ratios through daylight. A high mean full Moon contributes approximately \(30Y_0\) at zenith after phase, distance, altitude, and clear-air transmission. Both sources brighten toward the horizon. The physical mesh adds the exact display-domain difference

\[
T(Y_{\rm base}+Y_{\rm artificial})-T(Y_{\rm base}),
\]

so pollution is not tone-mapped once in the mesh and counted again in the procedural dome. The eight spectral bands are projected through sampled CIE 1931 colour-matching functions for hue, gamut-limited, and rescaled to the worker luminance, preserving the same relative-radiance calibration used by physical metrics. Low-light colour is then strongly desaturated.

The Realistic stellar endpoint follows the magnitude law directly:

\[
F_{\rm realistic}=0.35\,10^{-0.4m_{\rm apparent}}.
\]

Every catalogue star uses a unit-integral Gaussian atmospheric PSF. Given the simulated zenith seeing s, relative air mass X, and channel wavelength λ, its long-exposure FWHM is

\[
\epsilon(s,X,\lambda)=sX^{0.6}\left(\frac{\lambda}{500\,{\rm nm}}\right)^{-0.2},
\qquad \sigma=\frac{\epsilon}{2.35482}.
\]

The renderer evaluates the red, green, and blue Gaussians independently in angular units after converting arcseconds through the live camera field of view. The physical angular width is convolved in quadrature with a 0.42 CSS-pixel sampling footprint, so a subpixel star remains antialiased at naked-eye fields while the true seeing profile becomes resolved under deep zoom. Point quads extend to five sigma and discard their transparent tails; no opaque square sprite boundary remains. Broader seeing lowers the peak but does not create or remove integrated stellar flux. Consequently a magnitude-zero star still carries exactly 100 times the integrated pre-presentation signal of a magnitude-five star under the same extinction.

At 500 nm the preview also reports Fried's parameter r₀ = 0.98λ/ε and the frozen-flow coherence time τ₀ = 0.31r₀/V̄, where V̄ is the effective turbulence-weighted upper wind. Wind changes the temporal coherence, not the long-exposure FWHM by itself. Humidity, aerosols, and clouds remain in the independently calculated extinction, reddening, and scattered-light terms because ordinary weather values do not uniquely determine the integrated Cₙ² turbulence profile.

The shared physical fade

\[
V=\operatorname{clamp}\left(\frac{m_{\rm lim}-m_{\rm apparent}+0.32}{0.68},0,1\right)
\]

is applied after endpoint interpolation and is independent of \(e\). Atmospheric dispersion is \(1.2\cot(h)\) arcseconds and is converted with the same live angular camera scale. Stellar colour keeps spectral ordering while remaining subdued. A bounded display-only shoulder then improves small-point legibility:

\[
S_{\rm display}=S_{\rm linear}\,
\frac{1.6}{1+0.6S_{\rm linear}}.
\]

The gain approaches 1.6 for faint signals and rolls smoothly back to one at a unit signal before the linear-to-sRGB transfer. It does not change visibility or eligibility.

The Enhanced endpoint uses a monotonic compressed stellar mapping

\[
F_{\rm enhanced}=\operatorname{clamp}\!\left(10^{-0.08m_{\rm apparent}},0.22,1.6\right)
\operatorname{clamp}\!\left(1.08-0.025m_{\rm apparent},0.68,1\right).
\]

Brighter stars therefore remain brighter, but a five-magnitude contrast is compressed from 100:1 at the Realistic physical endpoint to roughly 2.6:1 at Enhanced under equal extinction. Faint stars receive the larger relative lift. Linear interpolation between endpoint signals makes that bright/faint ratio contract monotonically as \(e\) increases while keeping it strictly above one; the same progression broadens sprites and halos and increases visible chroma without changing the eligible set.

## 7. Worker, caches, and real progress

All expensive atmospheric work runs in a module Web Worker. Typed-array buffers are transferred rather than cloned. Kernel construction yields every 128 unit-source cells so a superseding slider message can stop stale work after roughly one small batch. Rapid changes are also debounced. An inline emission grid is committed to the worker LRU only after a complete result is posted, and only that result lets the hook issue later cache-only requests; cancelled work therefore cannot silently evict a grid which the hook still considers confirmed.

Caches are bounded least-recently-used maps: three emission grids, eight compact atmosphere kernels (one for every shipped weather preset), and one Fourier plan. Evicting a kernel also removes its dependent plan, and the previous plan is evicted before replacement allocation to avoid a two-plan memory spike. Once a source grid has completed one worker solve, a weather-only change sends its cache key and skips the main-thread geometry integration entirely; the progress panel marks Source grid as reused. A location change still performs and reports the real integration.

The visible overall progress is the physical solver's directly reported progress. Its normalized component weights are:

| Component | Physical-solver weight |
|---|---:|
| Emission validation/cache | 8% |
| Atmospheric kernel and FFT plan | 80% |
| Sky convolution and spectral conversion | 8% |
| Conservation/boundary diagnostics | 4% |

Kernel progress is the actual completed count of unit-source paths, throttled to about 30 updates per second rather than a timer animation. The hook enforces monotonic progress within one request. A compact live bar remains visible beside the weather presets, while the analysis drawer reports every component separately, source-layer and distance contributions, the modeled share from 300–1000 km, and measured grid/kernel/sky/check timings. The internal outermost-100-km value is explicitly a boundary-sensitivity indicator, not a convergence error or estimate of omitted light.

On the development machine, direct Node verification and a normal Chromium run currently measure approximately:

| Stage | Time |
|---|---:|
| Regional grid integration | 0.15–0.45 s |
| Live Custom 22-row atmosphere kernel in Chromium | 25–30 s |
| Load exact precomputed preset kernel | under 0.1 s locally |
| New 720-bearing Fourier plan in Chromium | 4–5 s |
| 81 × 720 × 22 × 8 convolution and diagnostics in Chromium | about 1 s |

Preset kernels remove the dominant initial path-integration cost; the FFT plan and convolution still run off the main thread with genuine progress. Panning, zooming, and time changes only move/rebuild the sky scene and do not recompute atmospheric transport. Custom settings retain the slower auditable live solve, including cancellation and progress. The eight preset assets are generated with up to four Node workers in about 23 seconds, while the browser runtime stays in TypeScript rather than adding a second Rust/Wasm numerical implementation. The star catalogue is emitted as its own production chunk.

## 8. Verification

`npm run test:physics` checks conservation, finite/non-negative output, linearity, rotational invariance, long-range scattering, direction, angular extent, adaptive-grid error, solid-angle quadrature, FFT-plan memory, and cached-solve latency. `npm run test:calibration` locks the four-site values above. At observer `51.5329° N, 18.9390° E`, the current deterministic result is:

- Łódź centre bearing: 54.598°.
- Computed horizon-glow peak: 55.25°.
- Integrated footprint: 1,552 quadrature samples across 59 sectors (29.5°) and 11 rings.
- Łódź bandwise conservation error: \(2.82\times10^{-14}\).
- Full regional-grid conservation error: \(4.81\times10^{-13}\).
- Linearity error: zero at Float32 output precision.
- Rotation error after a 73-sector source rotation: about \(1.2\times10^{-9}\).
- Independent north/east/south/west fixtures peak within 0.25° of their cardinal directions.
- In the complete regional field, the 40–70° Łódź lobe is about 1,061 times the opposite 220–250° lobe for this observer.
- On the shipped Typical-clear calibration grid, the 55° horizon is 16.031 SQM versus 21.802 SQM at 235°, a 5.771 mag directional contrast.
- A synthetic bright city at 600 km retains finite modeled radiance at 20° elevation.
- The asynchronous kernel builder demonstrably stops after a superseding cancellation check.
- Adaptive 0–10° interpolation is 0.62% RMS and 0.88% at p95 against dense transfer evaluations.
- The solid-angle mean of a horizon-peaked analytic profile differs by 0.11% from a 0.125° reference grid.
- The cached FFT plan is 111.5 MiB and the full sky convolution remains below the one-second regression ceiling.

`npm run test:e2e` launches Chromium, observes intermediate real worker percentages, verifies that the worker returned all 22 adaptive elevations, confirms the four physical components reach 100%, confirms neither zoom nor idle time triggers a second solve, changes to the Humid atmosphere preset, verifies that requested recomputation, and fails on page or console errors.

`npm run test:appearance` checks enhancement normalization and clamping, exact Realistic/Enhanced profile anchors, finite endpoint interpolation at 0/0.25/0.5/0.75/1, shared physical visibility and eligibility, Enhanced faint-star lift and monotonic dynamic-range compression, preserved brightness ordering, integral-normalized Realistic PSFs, colour and halo progression, camera-aware arcsecond-to-CSS-pixel dispersion conversion before interpolation, Realistic sky/moon/twilight response, and direct-cloud/extinction invariants. The appearance E2E case verifies the continuous accessible slider, persistence and legacy migration, requires solver requests, timings, progress, metrics, summary, eligibility, and canvas creation to remain invariant, and confirms that intermediate and endpoint frames still differ.

`npm run test:weather` validates all twelve fields and UI bounds for every preset, rebuilds all eight full shipped kernels and requires bit-for-bit parity with their binary assets, keeps numerical solver order fixed, and checks the exact direct-cloud transmission law. `npm run test:weather:regional` runs all eight full-resolution Warsaw fields with one bounded FFT plan at a time; it locks Typical clear to its anchor and polluted low/snow overcast to the measured 6–10× range. The browser companion confirms that Presets is the primary view, Custom is secondary and keyboard-operable, a preset change produces observable visible progress, daylight is not labeled Bortle, and moonless Warsaw moves from approximately 17.44 SQM / +5.0 / 402 stars when clear to about 15.3 SQM / +0.0 / zero stars under low overcast. A separate worker regression cancels both inline and cache-hit source analyses and proves that neither path can desynchronize the main-thread and worker LRU order.

## 9. Limitations

- Conservation proves that supplied proxy totals are neither lost nor duplicated. The four-site fit constrains central-Poland clear-sky zenith contrast, but does not turn those totals into calibrated watts or measured upward radiance.
- Bundled settlement populations, built areas, lighting factors, spectra, and ellipses are rounded regional proxies.
- The mixed eight-band spectrum does not yet infer local lamp technology, curfew, operating schedule, snow response, or wavelength-dependent upward-emission functions.
- Geometry is uniformly emissive within each settlement ellipse. Results are quantized by quadrature spacing, the 4096-sample cap, rings, and half-degree sectors.
- Coverage is limited to the selected, incomplete bundled settlement catalogue. The OpenStreetMap base map is a location picker only and does not supply light-emission data.
- The 300–1000 km tail is intentionally coarse; directional sources at or beyond 1000 km are reported but not propagated.
- Rays are straight and unrefracted on a spherical Earth. The live solve uses a 60 km atmosphere top and fixed 0.15 km source/observer altitude.
- Terrain, buildings, vegetation screening, resolved three-dimensional clouds, vertical weather soundings, polarization, ozone absorption, and within-band spectral lines are not modeled.
- Multiple scattering is a scalar bounded closure that preserves the first-order angular pattern, not a full 3-D Monte Carlo solution.
- The low-cloud urban-return factor is a bounded central-Poland calibration of unresolved artificial-light return. It does not predict individual cloud cells, precipitation, fog, or every rural cloud response.
- Natural airglow, zodiacal light, moonlight, twilight, stars, and the Milky Way are outside the artificial-glow transfer solve and are added with separate rendering heuristics.
- RGB, SQM, Bortle, and limiting magnitude are heuristic transforms of relative radiance. Bortle labels are meaningful only during astronomical darkness; twilight/daylight frames must not be compared to clear-night survey values. A measured upward-radiance inventory, terrain, resolved weather, and local SQM calibration are required for predictive photometry.

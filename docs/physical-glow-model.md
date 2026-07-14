# Physical night-glow model

This document describes the implemented model, not a proposed future model. The pipeline is deliberately linear in emitted light so that a city’s total proxy flux can be spread over its full width without gaining energy, then propagated through one reusable atmosphere:

```text
regional settlement totals + OpenStreetMap geometry
                         ↓ conserved spatial fusion
81 distance rings × 720 bearings × 8 wavelength bands
                         ↓ curved-Earth spectral transfer kernel
positive zero-padded FFT circular convolution
                         ↓
22 adaptive elevations × 720 bearings × spectrum, RGB, and limiting magnitude
                         ↓
3-D glow mesh + directional stars, Milky Way, planets, and deep sky
```

All geographical distances are kilometres. Bearings are clockwise from north. Emission is currently a relative radiant-flux proxy rather than calibrated watts, so the spatial and radiative-transfer calculations are quantitative relative to the supplied inventory. SQM, Bortle, RGB, and naked-eye values are heuristic display indices, not photometric predictions.

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

- Ellipses use deterministic equal-area Hammersley samples. A settlement therefore occupies many angular and radial cells, even when only a proxy ellipse is available.
- Polygons use a uniform local tangent-plane lattice and retain cell centres inside the boundary. Sub-resolution polygons retain vertices and edge midpoints rather than collapsing to one centroid.
- Roads use length-weighted midpoint samples along every segment. Non-zero road width uses a \(1:4:1\) cross-road quadrature.

The default spacing is 0.5 km with a maximum of 4096 samples per source. The weight normalization makes the grid an integral of a uniformly emissive footprint, not a collection of independent point lights.

### Evidence precedence

Sources estimating the same physical coverage share a `coverageId`. Only the highest evidence priority in a group is retained:

\[
p_{\rm inventory}=400,\qquad
p_{\rm measured}=300,\qquad
p_{\rm built/population}=200,\qquad
p_{\rm road}=100.
\]

Sources tied at the winning priority are additive. This allows several refined polygons plus a residual ellipse to represent one conserved settlement total, while a later calibrated inventory or measured-radiance layer can supersede every proxy shard using the same identifier.

## 2. Regional settlement totals and OSM refinement

For bundled settlement \(p\), the relative upward-flux total is

\[
\Phi_p=c I_p\left(0.72A_p+0.28\frac{P_p}{3200}\right),
\]

where \(A_p\) is proxy built area in km², \(P_p\) is proxy population, \(I_p\) is a lighting-intensity factor, and \(c\) is configurable flux per equivalent lit km². The default mixed sodium/white-LED band fractions are

\[
(0.055,0.090,0.115,0.145,0.170,0.210,0.130,0.085).
\]

This total is initially uniform over the settlement ellipse. For Łódź, for example, the ellipse has 13 km and 9.5 km semi-axes rather than one coordinate at the city centre.

If OSM built geometry lies inside footprint \(p\), only a capped fraction of the existing total moves into that geometry:

\[
f_p=\min\left(0.7,\frac{\sum_i A_i}{\pi a_p b_p}\right).
\]

Nearby roads are treated as evidence for where lighting is concentrated, not as an automatic second emission inventory. For detailed built feature \(i\),

\[
R_i=\sum_\ell L_\ell\exp(-d_{i\ell}/D),\qquad D=3\ \mathrm{km},
\]

\[
\beta_i=\min\left(\beta_{\max},\gamma\frac{R_i}{\max(1,A_i)}\right),
\qquad W_i=B_i(1+\beta_i),
\]

where \(L_\ell\) is road length, \(d_{i\ell}\) is sampled feature distance, and \(B_i\) is the built-feature proxy (with area as its zero-flux fallback). Allocation and residual are

\[
\Phi_{pib}=f_p\Phi_{pb}\frac{W_i}{\sum_m W_m},
\qquad
\Phi^{\rm residual}_{pb}=(1-f_p)\Phi_{pb}.
\]

Therefore

\[
\sum_i\Phi_{pib}+\Phi^{\rm residual}_{pb}=\Phi_{pb}.
\]

Covered place nodes are suppressed as duplicate estimates. Covered roads only change weights. Uncovered built features retain their combined linear proxy total; only truly orphaned roads become standalone road proxies. If no directional source exists, the fallback remains explicitly isotropic and directional cells stay zero.

## 3. Curved-Earth single scattering

The observer and every source lie on a sphere of IUGG mean radius \(R_\oplus=6371.0088\) km. A view ray exits the spherical atmosphere at an exact ray/sphere intersection. Source-to-scatter and scatter-to-observer columns are integrated independently, and a source contributes only when its local upward-emission cosine is positive. This provides Earth-curvature screening while retaining light that reaches high-altitude scatterers hundreds of kilometres away.

For one unit of upward spectral power, first-order radiance in view direction \(\hat v\) is

\[
L^{(1)}_\lambda(\hat v)=
\int_0^{s_{\rm top}}
\frac{U(\mu_s)}{r_s^2+r_0^2}
\exp[-\tau_\lambda(s\rightarrow x)-\tau_\lambda(x\rightarrow o)]
\left[
\beta_R p_R+eta_a\omega_a p_a+eta_c\omega_c p_c
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

Kernel keys hash atmosphere, transfer options, bands, and sampling grid. Plan keys additionally hash ring layout, elevation list, and sector count. Exact repeats reuse both. The 22-row kernel is about 0.79 MiB and its 720-bearing FFT plan is 111.5 MiB; the worker retains only one plan and evicts it before allocating a replacement. Serialization/deserialization is implemented for optional persistent kernel precomputation, while the large derived FFT plan remains a runtime cache.

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

### 6.1 Atlas and Realistic presentation

The solver field is independent of the selected presentation. **Atlas** retains the enhanced object colours, broad stellar sprites, and high-exposure glow useful for finding objects. **Realistic** is the default human-view approximation. Changing between them rebuilds only GPU geometry/materials and never starts a worker request.

Realistic mode combines natural sky, astronomical twilight, moonlight, and artificial radiance before applying one relative eye/display response. With total luminance (Y) and the natural reference (Y_0=0.0020016), the linear SDR target is

\[
Y_{\rm display}=\min\left[0.03,\;0.0015\left(\frac{Y}{Y_0}\right)^{0.42}\right].
\]

The 0.42 exponent represents dark-to-mesopic adaptation on an uncalibrated monitor; it is not an absolute display calibration. Astronomical twilight begins at a solar altitude of (-18^\circ). Its global reference term is (180tY_0), where (t=\operatorname{clamp}[(h_\odot+18)/18,0,1]). The lunar term is (8MY_0), where (M) is illuminated fraction multiplied by the positive sine of lunar altitude. The physical mesh adds the exact display-domain difference

\[
T(Y_{\rm base}+Y_{\rm artificial})-T(Y_{\rm base}),
\]

so pollution is not tone-mapped once in the mesh and counted again in the procedural dome. The eight spectral bands are projected through sampled CIE 1931 colour-matching functions for hue, gamut-limited, and rescaled to the worker luminance so Atlas metrics and Realistic presentation share the same relative-radiance calibration. Low-light colour is then strongly desaturated; the mesopic weight is evaluated after converting the natural-sky ratio to an approximate cd/m² scale.

Realistic stellar signal follows the magnitude law directly:

\[
F_\star=0.35\,10^{-0.4m_{\rm apparent}}V,
\]

where (V) is a smooth half-magnitude detection fade. The Gaussian core plus atmospheric halo is integral-normalized, so broader seeing redistributes this signal without creating energy. Consequently a magnitude-zero star carries exactly 100 times the integrated signal of a magnitude-five star before clipping. The sampled core FWHM is approximately 0.9–1.3 CSS pixels. Atmospheric dispersion is calculated in arcseconds from (1.2\cot(h)), converted using the live canvas height and vertical field of view, and capped at 0.35 pixel. Stellar colour keeps spectral ordering but its chroma falls from at most about 0.34 for the very brightest objects to 0.04 by magnitude three.

For consistency, the Realistic summary and catalogue count use the same conservative visual threshold as the renderer:

\[
m_{\rm realistic}=\min\left[m_{\rm physical},\;7.15-0.8(21.92-\mathrm{SQM})\right].
\]

This empirical presentation threshold does not feed back into atmospheric transport. It prevents an urban Realistic view from hiding faint stars while still claiming an Atlas-style sixth-magnitude limit.

## 7. Worker, caches, and real progress

All expensive atmospheric work runs in a module Web Worker. Typed-array buffers are transferred rather than cloned. Kernel construction yields every 128 unit-source cells so a superseding slider message can stop stale work after roughly one small batch. Rapid changes are also debounced; only a completed result confirms that an emission grid is safe to reference by cache key.

Caches are bounded least-recently-used maps: three emission grids, four atmosphere kernels, and one Fourier plan. Evicting a kernel also removes its dependent plan, and the previous plan is evicted before replacement allocation to avoid a two-plan memory spike.

The visible overall progress reserves 10% for the OSM survey and 90% for the physical solver. Inside the solver the normalized weights are:

| Component | Physical-solver weight |
|---|---:|
| Emission validation/cache | 8% |
| Atmospheric kernel and FFT plan | 80% |
| Sky convolution and spectral conversion | 8% |
| Conservation/boundary diagnostics | 4% |

Kernel progress is the actual completed count of unit-source paths, throttled to about 30 updates per second rather than a timer animation. The hook enforces monotonic progress within one request. The panel also reports every component separately, source-layer and distance contributions, the modeled share from 300–1000 km, and measured grid/kernel/sky/check timings. The internal outermost-100-km value is explicitly a boundary-sensitivity indicator, not a convergence error or estimate of omitted light.

On the development machine, `npm run test:physics` currently measures approximately:

| Stage | Time |
|---|---:|
| Regional grid integration | 25–45 ms |
| New 22-row atmospheric kernel | 2.2–2.9 s |
| New 22-row Fourier plan | 0.5–0.7 s |
| Cached 81 × 720 × 22 × 8 convolution | 80–110 ms |

The kernel and FFT plan are the only material initial costs; both run off the main thread and are cached. Panning, zooming, and time changes only move/rebuild the sky scene and do not recompute atmospheric transport. Cached location updates solve in roughly a tenth of a second without blocking interaction. A Rust/Wasm implementation would add a boundary and duplicate numerical code for work already isolated from the render loop, so the implementation keeps the solver in auditable TypeScript for now. The star catalogue is emitted as its own production chunk.

## 8. Verification

`npm run test:physics` checks conservation, finite/non-negative output, linearity, rotational invariance, long-range scattering, direction, angular extent, adaptive-grid error, solid-angle quadrature, FFT-plan memory, and cached-solve latency. At observer `51.5329° N, 18.9390° E`, the current deterministic result is:

- Łódź centre bearing: 54.598°.
- Computed horizon-glow peak: 55.25°.
- Integrated footprint: 1,552 quadrature samples across 59 sectors (29.5°) and 11 rings.
- Łódź bandwise conservation error: \(3.60\times10^{-14}\).
- Full regional-grid conservation error: \(5.92\times10^{-13}\).
- Linearity error: zero at Float32 output precision.
- Rotation error after a 73-sector source rotation: about \(1.2\times10^{-9}\).
- Independent north/east/south/west fixtures peak within 0.25° of their cardinal directions.
- In the complete regional field, the 40–70° Łódź lobe is about 960 times the opposite 220–250° lobe for this observer.
- A synthetic bright city at 600 km retains finite modeled radiance at 20° elevation.
- The asynchronous kernel builder demonstrably stops after a superseding cancellation check.
- Adaptive 0–10° interpolation is 0.62% RMS and 0.88% at p95 against dense transfer evaluations.
- The solid-angle mean of a horizon-peaked analytic profile differs by 0.11% from a 0.125° reference grid.
- The cached FFT plan is 111.5 MiB and the full sky convolution remains below the one-second regression ceiling.

`npm run test:e2e` launches Chromium, observes intermediate real worker percentages, verifies that the worker returned all 22 adaptive elevations, confirms zoom does not trigger a physical recomputation, waits for every component to reach 100%, changes to the Humid atmosphere preset, verifies a second solve, and fails on page or console errors.

`npm run test:appearance` checks the Realistic sky-response anchors, magnitude law, integral-normalized PSF, stellar chroma, sprite size, atmosphere-dependent dispersion, and visual-limit calibration. The appearance E2E case verifies accessible keyboard selection, persistence, consistent presentation metrics, and that a mode switch leaves the completed physical field untouched.

## 9. Limitations

- Conservation proves that supplied proxy totals are neither lost nor duplicated. It does not prove that those totals are calibrated watts or measured upward radiance.
- Bundled settlement populations, built areas, lighting factors, spectra, and ellipses are rounded regional proxies. OSM changes their spatial distribution but normally not the absolute settlement total.
- The mixed eight-band spectrum does not yet infer local lamp technology, curfew, operating schedule, snow response, or wavelength-dependent upward-emission functions.
- OSM/ellipse association samples feature centres, vertices, and segment midpoints rather than computing exact polygon intersections. Overlapping built polygons are summed before the refinement cap instead of using their exact union area.
- Geometry is uniformly emissive within an ellipse/polygon and per unit length along a road. Results are quantized by quadrature spacing, the 4096-sample cap, rings, and half-degree sectors.
- Local detailed OSM land-use and roads cover 15 km and regional OSM place nodes cover 300 km. Beyond that, coverage is only the selected, incomplete bundled settlement catalogue.
- The 300–1000 km tail is intentionally coarse; directional sources at or beyond 1000 km are reported but not propagated.
- Rays are straight and unrefracted on a spherical Earth. The live solve uses a 60 km atmosphere top and fixed 0.15 km source/observer altitude.
- Terrain, buildings, vegetation screening, resolved three-dimensional clouds, vertical weather soundings, polarization, ozone absorption, and within-band spectral lines are not modeled.
- Multiple scattering is a scalar bounded closure that preserves the first-order angular pattern, not a full 3-D Monte Carlo solution.
- Natural airglow, zodiacal light, moonlight, twilight, stars, and the Milky Way are outside the artificial-glow transfer solve and are added with separate rendering heuristics.
- RGB, SQM, Bortle, and limiting magnitude are heuristic transforms of relative radiance. A measured upward-radiance inventory and local SQM calibration are required for predictive photometry.
- Public Overpass availability varies. Timeout does not erase the regional model, but it lowers data specificity because local OSM refinement is missing.

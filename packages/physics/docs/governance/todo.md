# Master research and design TODO

Checkboxes are intentionally open. Creating this design does not resolve them.

## Architecture and governance

- [ ] Review crate boundaries and name the maintainer/reviewer for each physical module.
- [x] Keep `packages/environment/` independent and consume its independently versioned emission and atmospheric releases through one-way decoder dependencies or conforming decoders. See `docs/../contracts/environment.md`.
- [ ] Approve canonical SI quantities, spectral-radiance convention, coordinate frames, and time scales.
- [ ] Define the model-revision policy; kernel-producing changes must invalidate all dependent assets.
- [ ] Define feature flags without allowing mutually inconsistent physics combinations.
- [ ] Record accepted decisions as short ADRs under `docs/decisions/`.

## Astronomy

- [ ] Select ephemeris implementation/data and validate Sun, Moon, and planets against JPL.
- [ ] Specify UTC/TAI/TT/UT1/TDB conversion and leap-second/Earth-orientation data updates.
- [ ] Define astrometric to apparent-place pipeline: parallax, proper motion, radial velocity, aberration, precession-nutation, deflection, refraction.
- [ ] Define planet phase, radius, BRDF/phase-function, and spectral-albedo models.
- [ ] Define lunar topographic/photometric model and observer-dependent phase.
- [ ] Define earthshine calculation and identify which feedback orders are included.
- [ ] Decide how occultation, twilight, terrain horizon, and below-horizon refracted sources behave.

## Stars and diffuse sky

- [ ] Audit Gaia DR3 fields, quality filters, passbands, completeness, bright-star limitations, and license/attribution.
- [ ] Choose supplementary bright-star, radial-velocity, variable-star, and spectral libraries.
- [ ] Design HEALPix/HiPS-like catalogue LOD and proper-motion safety margins.
- [ ] Define conversion from catalogue photometry/spectra to the runtime spectral basis.
- [ ] Separate resolved stars, unresolved integrated starlight, nebular emission, diffuse Galactic light, dust extinction, zodiacal light, and airglow.
- [ ] Identify a calibrated, licensable all-sky spectral radiance source; do not treat a colour visualization as calibrated data.
- [ ] Define seams, flux conservation, and anti-double-counting between catalogue and diffuse components.

## Atmosphere and radiative transfer

- [x] Establish the ownership boundary: Environment owns 4-D environmental state and evidence/fallback semantics; Physics owns state-to-spectral-optics closure and all propagation.
- [x] Implement and test the first-slice `AtmosphereFieldProvider` adapter and shared native/Wasm conformance fixture; regional chunk planning/interpolation remains phase-gated.
- [ ] Choose the Physics volume/grid representation and conservative interpolation from hybrid/pressure/height/surface coordinates.
- [x] Define canonical `SourceEvidenceClass`, `AtmosphereSelectionMode`, time/revision identities and `ObserverScenario`; implementation must preserve them in scenarios and caches.
- [ ] Validate that source-to-observer domain selection includes polluted source air, elevated plumes, clouds and Earth curvature rather than only the observer column.
- [ ] Define fallback behavior for unavailable fields; accept only named joint climatology samples, bounded scenarios or explicit standard profiles.
- [ ] Prohibit PM/AOD/visibility scalar substitution and test ambient-wet versus dry aerosol handling against double humidity growth.
- [ ] Choose molecular absorption database/parameterization and spectral-resolution strategy.
- [ ] Select aerosol families, size distributions, hygroscopic growth, and phase functions.
- [ ] Select cloud optical models for water/ice, sub-grid coverage, and anisotropic scattering.
- [ ] Decide scalar versus polarized transfer and document the scientific cost of deferring polarization.
- [ ] Choose reference solver and interactive approximation: discrete ordinates, Monte Carlo, successive orders, precomputed scattering, or hybrid.
- [ ] Define spherical-shell, refractive, and terrain-aware geometries.
- [ ] Define scattering-order termination by residual/error, not a fixed visually chosen count.
- [ ] Establish reciprocity, positivity, conservation, and limiting-case tests.

## Surface, terrain, and artificial illumination

- [ ] Select global DEM and derive horizon/visibility products with curvature/refraction policy.
- [ ] Select land/water/snow BRDF/albedo datasets and define night-time extrapolation.
- [ ] Define ocean glint/wave model and snow/ice handling.
- [ ] Verify the Environment emission domain contract preserves corrected reference-view `J_DNB`, exact support, profiles/status, source height, uncertainty, provenance, and licence partition.
- [ ] Implement only the Physics adapter/scenario policy; raw satellite correction, inventories, luminaire/source fusion, and OSM/built-surface redistribution remain Environment emission domain responsibilities.
- [ ] Define Physics behavior for unresolved spectrum/angle/time: insufficient evidence, supported bounds, and explicitly named scenarios with no hidden defaults.
- [ ] Prove the initial outgoing Environment signal is not passed through the ground BRDF twice.
- [ ] Define wavelength-dependent ground reflection and repeated atmosphere-surface coupling.
- [ ] Validate constructed artificial boundary sources against Environment conformance fixture and validate the combined source-plus-propagation result on independent regional measurements.

## PSF and observation

- [ ] Freeze current TypeScript Gaussian seeing behavior as a parity fixture.
- [ ] Decide supported atmospheric PSFs: Kolmogorov, von Karman, Moffat approximation, anisoplanatism, differential chromatic refraction.
- [ ] Define optical diffraction, aberration, sensor pixel response, eye response, and motion separately.
- [ ] Define spatially varying PSF strategy near the horizon and across wide fields.
- [ ] Preserve unit integral/flux and test angular sampling at every LOD.
- [ ] Distinguish point-source PSF from diffuse-field filtering and glare/bloom display effects.

## Spectral colour and photometry

- [ ] Choose runtime wavelength bands/basis and reference high-resolution spectral grid.
- [ ] Quantify band-integration error for LEDs, sodium, lunar spectra, ozone/oxygen features, and stellar colours.
- [ ] Define photopic, scotopic, mesopic, melanopic, camera, and display observer transforms as observation layers.
- [ ] Decide whether fluorescence/chemiluminescence is needed for airglow.
- [ ] Define absolute calibration and physical sensor/eye response products; specify the Viewer-owned exposure, white-balance, gamut and tone-map contract without implementing them as Physics state.

## Numerics and performance

- [ ] Establish error budgets for angular, spatial, spectral, temporal, and scattering dimensions.
- [ ] Implement convergence harness before optimizing kernels.
- [ ] Benchmark exact mixed-radix transforms for 720 azimuth samples against padded FFT memory/time.
- [ ] Decide reference `f64`, interactive `f32`, and mixed-precision boundaries from measured error.
- [ ] Design sparse/adaptive horizon resolution and importance scheduling.
- [ ] Define deterministic parallel reductions and reproducible precompute builds.
- [ ] Set browser budgets for startup, frame time, solver latency, memory, asset bytes, and GPU resources.

## Native precompute

- [ ] Define input manifest, fetch/import separation, local raw-data cache, and immutable output schema.
- [ ] Define atmospheric/surface transfer LUT axes and interpolation error checks.
- [ ] Consume atmosphere chunks and manifests rather than importing global forecast/reanalysis archives inside Physics.
- [ ] Define catalogue/diffuse/terrain tile formats and spatial indexes; consume rather than redefine the Environment emission domain release/chunk format.
- [x] Consume the emission-domain conformance fixture in native and Wasm tests instead of inventing a second emission schema.
- [ ] Add resumable jobs without publishing incomplete outputs.
- [ ] Emit per-product provenance, uncertainty, convergence, statistics, and hashes.
- [ ] Produce a small openly redistributable fixture for CI and review.

## Wasm and workers

- [ ] Design coarse handle-based ABI and typed-array layouts.
- [ ] Benchmark Environment regional atmosphere decode/interpolation, transfer to Physics, memory high-water and cancellation separately from the solve.
- [x] Prove native/Wasm parity on the same serialized first-slice fixture; broader scientific fixtures remain phase-gated.
- [x] Implement the single-worker first-slice baseline before optional shared-memory workers.
- [ ] Measure copy versus transfer versus shared-memory costs.
- [x] Add first-slice revision cancellation, bounded yield points, staged progress, buffer/runtime reclamation and stable-memory tests; numerical residual progress remains solver-phase work.
- [ ] Define browsers without SIMD/threads and memory-pressure recovery.

## WebGL2 and delivery

- [ ] Audit required extensions and fallback formats for float textures/filtering/render targets.
- [ ] Choose spectral texture packing, angular resolution, tile borders, and LOD blending.
- [ ] Use stable instanced/batched star buffers rather than per-star objects.
- [ ] Keep composition in linear HDR and tone map once.
- [ ] Add GPU timer queries and resource accounting outside production-critical paths.
- [ ] Configure immutable asset caching and optional `COOP`/`COEP` on Vercel.
- [ ] Test cross-origin assets, service worker/cache versioning, and deployment rollback.
- [ ] Define supported browser/device matrix and automatic fidelity selection.

## Validation and release

- [ ] Create analytic limiting cases and unit-level invariants for every module.
- [x] Run the first-slice emission-domain and atmosphere-domain boundary conformance fixtures in native and Wasm Physics builds; broader real-data cases remain open.
- [ ] Compare radiative transfer to libRadtran or another accepted reference solver.
- [ ] Compare astrometry to SOFA/JPL reference cases.
- [ ] Compare PSF metrics with ESO conventions and synthetic flux tests.
- [ ] Acquire calibrated all-sky observations spanning dark, moonlit, urban, cloudy, aerosol, and twilight cases.
- [ ] Separate numerical error, input uncertainty, model inadequacy, and display differences in reports.
- [ ] Require convergence evidence before describing any increase as “high resolution.”
- [ ] Publish scientific model card, data/license manifest, reproducible build instructions, and known limitations.

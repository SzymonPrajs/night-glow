# Validation plan

## 1. Definition of “correct enough”

Correctness is a set of quantity-specific tolerances supported by analytic limits, external references, convergence, observations, and uncertainty—not visual approval alone. Each module owns local tests; the validation crate owns cross-module scenarios and reports.

## 2. Validation layers

### A. Structural invariants

- all values finite or explicitly masked;
- radiance/extinction non-negative where physically required;
- phase functions and PSFs normalized under the correct measure;
- BRDF and scattering obey energy constraints;
- compatible units, frames, epochs, bases, and revisions before composition;
- deterministic cache invalidation and no publication after cancellation.

### B. Analytic/limiting cases

- vacuum: inverse-square celestial flux and no atmospheric glow;
- pure absorption: Beer–Lambert transmission;
- optically thin single scatter: known integral/asymptotic behavior;
- rotationally symmetric atmosphere: rotation invariance;
- Lambertian surface: constant BRDF and hemispherical energy result;
- zero albedo/cloud/aerosol/source limits;
- delta/constant fields through convolution;
- phase/new/full Moon geometry and occultation boundaries.

### C. External numeric references

- radiative transfer versus libRadtran or another accepted solver over a scenario matrix;
- atmospheric/scattering LUTs versus direct high-accuracy integration;
- apparent positions/time/frame conversions versus IAU SOFA and JPL/Horizons/DE reference vectors;
- lunar/planet phase/photometry against accepted models/data;
- PSF FWHM, wavelength/airmass scaling, and encircled energy against declared conventions.

### D. Convergence

Sweep vertical layers, angular nodes, spectral bands, spatial LOD, phase-function order, scattering orders/iterations, LUT resolution, FFT/convolution method, PSF radius, and precision. Reports plot error versus cost and identify asymptotic floors. A higher setting is released only when expected monotonic or bounded convergence is observed.

### E. Native/Wasm/render parity

Serialize identical small scenarios and compare reference native, optimized native, Wasm single-worker, Wasm threaded where supported, and WebGL-consumed output readback/diagnostics. Tolerances are per physical quantity. Display screenshots supplement but do not replace numeric checks.

### F. Environment Atlas emission domain boundary conformance

Consume the emission-domain open fixture in both native and Wasm paths. Verify exact preservation of `J_DNB` before propagation; corrected reference-view/DNB response identity; WGS84 support, height/datum, and source-local direction conventions; mixed-resolution hierarchy; resolved/unresolved/`CoverageStatus`/`DataValidity` behavior; temporal context and reference factor; uncertainty/evidence/provenance retention; joint spectral/angular DNB forward closure; and cache invalidation across emission revisions.

Explicit negative tests prove that Physics does not replay the satellite-path correction, multiply by `pi` without a named scenario, invent a spectrum/angular/time profile, use H3 averages as physical geometry, or apply the ground BRDF to the initial outgoing atlas value.

### G. Environment Atlas atmosphere boundary conformance

Consume the atmosphere-domain fixture in native and Wasm paths. Verify exact coordinate/vertical reconstruction; units and mass/column conservation; `AtmosphereSelectionMode`; per-field `SourceEvidenceClass`; source-run/analysis/valid/lead/member, observation-correction, climatology-model/sample or standard-scenario identity; wet/dry aerosol semantics; uncertainty, `DataValidity`, provenance and licence retention; interpolation across chunk/time/vertical boundaries; and cache invalidation across release, run and atmospheric-optics revisions.

Negative cases prove that Physics does not interpret missing fields as clear air, use PM/AOD/visibility as a complete optical state, apply humidity growth to already ambient-wet optics, claim a climatology sample is a forecast, or reduce the transfer domain to the observer's local column. Include a synthetic polluted-city boundary layer and elevated plume whose light reaches a clean rural observer over curved Earth.

### H. Observation comparison

Use calibrated all-sky spectral or multispectral measurements with observer location/height, time, weather/aerosol/cloud state, instrument response, exposure/calibration, Moon/Sun geometry, and nearby lighting context. Include dark rural, urban, moonlit, twilight, aerosol, clear, low cloud, and snow cases. Fit/calibration cases remain separate from held-out validation.

## 3. Conservation and bookkeeping

For each source/component/order report input flux/power, directly transmitted/escaped/absorbed/reflected portions where calculable, observer radiance contribution, domain truncation, and numerical residual. Exact global conservation may not be directly measurable for every operator, but every approximation must have a defined local or integrated check.

Resolved/diffuse transitions receive a specific anti-double-count test: increasing the resolved-star threshold should redistribute flux between representations without materially changing the convolved aggregate field away from individually resolved stars.

## 4. Scenario matrix

Minimum scientific fixtures:

| Scenario | Purpose |
|---|---|
| Vacuum point source | photometry, inverse square, PSF normalization |
| Molecular clear sky, Sun | single/multiple scatter and twilight |
| Aerosol phase sweep | forward scattering and spectral law |
| Uniform cloud slab | high optical depth and artificial-light amplification |
| Lambertian flat Earth | surface coupling analytic/reference case |
| Terrain ridge and city | occlusion, horizon, source height |
| New/quarter/full Moon | phase, earthshine, atmosphere |
| Galactic plane/pole | catalogue/diffuse transition and PSF |
| Rotated synthetic emission | rotational invariance and FFT/circular indexing |
| Emission conformance fixture | independent schema/profile/coordinate/uncertainty contract |
| Atmosphere conformance fixture | run/evidence/vertical/wet-dry/missingness contract and heterogeneous volume |
| Current Warsaw fixture | migration regression, not absolute scientific truth |

## 5. Performance is a separate report

Measure precompute wall time/peak memory/output bytes, Wasm startup/compile, first coherent result, refinement latency, cancellation latency, worker utilization, memory high-water, JavaScript↔Wasm bytes/calls, upload bytes, GPU time, and frame time. A performance pass cannot waive a failed numeric tolerance.

## 6. Release evidence

Each scientific release archives manifests/hashes, model card and limitations, reference and convergence reports, parity report, observational held-out report, performance/browser matrix, license/attribution report, and known failures. The report must distinguish numerical error, input uncertainty, model inadequacy, and display differences.

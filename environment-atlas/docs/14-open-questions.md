# 14. Open questions and decision register

Questions are ranked by whether they block correct implementation. A question closes only with a recorded experiment/decision, not intuition.

## P0 — blocks the first implementation

| Question | Required experiment/evidence | Exit criterion |
| --- | --- | --- |
| Which Black Marble C2 product/layers define the annual reference: A2-derived robust composite, A3, A4 near-nadir, or A4 all-angle? | Decode common sites/products; compare QA, observation counts, view geometry, stability, direct/gap-filled behavior, and EOG | Written product choice with exact SDS list and demonstrated unit/geometry consistency |
| What exactly is the corrected radiance view convention used for `J_DNB`? | Trace User Guide/ATBD equations and metadata; forward-check multi-angle/near-nadir products | A normalized quantity definition that does not imply hemispheric flux |
| What are fill/negative/background/censoring semantics? | Provider docs plus rural/ocean/dark control histograms | No-data, below-detection, valid negative/noise, and zero rules encoded and tested |
| Does annual processing require all daily global A2 data? | Compare A3/A4 with a daily-derived composite on stratified tiles | Use smallest product set that preserves required QA/uncertainty |
| Can OSM-derived posterior cells be openly distributed under the desired product terms? | ODbL legal review with concrete data-flow/output examples | Approved release partition/licence/attribution plan |
| What exact schema/decoder dependency will Physics use? | Benchmark a published `atlas-schema`/`atlas-format` dependency against an independently conforming decoder in native and Wasm builds | One-way dependency decision with the same conformance fixture and no ingestion/solver coupling |
| What normalization algebra closes `J_DNB` across spectrum and angle? | Forward-integrate candidate joint profiles through the exact DNB response and corrected reference view | Schema fields and tolerance that reproduce `J_DNB` without a hidden Lambertian or spectral assumption |

## P1 — blocks useful spatial refinement

| Question | Experiment | Exit criterion |
| --- | --- | --- |
| How much of coarse glow should be assigned to roads, buildings, facilities, or diffuse support? | Fit forward observation model using calibrated fine nighttime imagery/inventories; whole-city holdouts | Model beats uniform/built-only baselines with calibrated uncertainty across regions |
| How should OSM completeness control prior strength? | Compare OSM features to WSF/GHSL/building footprints and validation truth by region | Completeness estimator predicts allocation error and prevents sparse-map darkening |
| What is the effective DNB footprint/PSF after gridding/compositing? | Point/isolated-source and fine-image comparisons by scan/view/brightness | Versioned support model or evidence that footprint-only allocation suffices |
| Are H3 8/9/10 the right levels? | Accuracy/size/runtime comparison on representative regions | Chosen adaptive rule meets spatial and storage budgets without false precision |
| How are residual non-settlement sources classified? | Cross-reference fires/flares/vessels/platforms and temporal stability | Stable and transient classes have explicit inclusion/layer policies |

## P1 — blocks physical spectrum/angle claims

| Question | Experiment | Exit criterion |
| --- | --- | --- |
| What wavelength grid gives required scattering accuracy? | Integrate measured LED/HPS/LPS spectra through molecular/aerosol transfer at candidate bin widths | Selected grid meets band/sky-radiance error target including sodium lines |
| How should DNB-blind blue uncertainty be represented? | Fit spectral mixtures at calibrated RGB/inventory sites; test LED retrofit cases | Posterior intervals cover measured visible spectra and ground skyglow |
| Which UEF families are identifiable from public evidence? | Inventory + multi-angle + ground validation sites | Only demonstrably identifiable families enter default estimates; otherwise unresolved |
| Is vegetation attenuation already removed? | User Guide says vegetation correction is not applied in C1/C2; test seasonal canopy sites | Explicit vegetation status and either correction model or uncertainty term |

## P2 — temporal enrichment

| Question | Experiment | Exit criterion |
| --- | --- | --- |
| Which public datasets provide within-night curves at useful scale? | Audit TESS, all-sky cameras, municipal controls, ISS/TEMPO opportunities, and studies | Source list with licence, calibration, coverage, and transfer limits |
| Can source-class profiles transfer between cities? | Train/hold out entire municipalities across seasons and regions | Inferred profiles beat constant reference with calibrated uncertainty |
| How are civil policy, solar time, and sunset-relative behavior combined? | Schema/runtime examples across DST boundaries and high latitudes | Unambiguous evaluation and reference normalization tests |

## P2 — format and operations

| Question | Experiment | Exit criterion |
| --- | --- | --- |
| What is actual Europe/global lit-cell cardinality? | Native and refined proving builds | Measured resolution/evidence histogram drives format sizing |
| Which intensity/uncertainty quantisation is safe? | Sweep codes over rural-to-flare distribution and propagate through solver | Error below agreed source and sky-radiance budgets, no silent saturation |
| Which chunk parent and compression work in Wasm? | Browser/native benchmarks for representative dense/sparse chunks | Random lookup, cap scan, memory, size, and decode targets met |
| What adaptive propagation tail bound is tight enough? | Solver convergence tests under clean/hazy/high-altitude/metropolis cases | Certified stopping criterion; no arbitrary 150 km cutoff |

## Decisions already made

- The architecture is global; Europe is a proving scope only.
- Environment Atlas atmospheric **state** and Physics atmospheric **optics/propagation** are separate products; see [ADR 0003](decisions/0003-environment-atlas.md).
- OSM and settlement data are priors, not radiometry.
- Baseline conservation uses surface-integrated DNB directional intensity.
- Missing spectrum, angle, and time profiles remain unresolved.
- H3 is the proposed index for experiments; physical geometry is not approximated by average H3 areas.
- No implementation code is part of the design phase.

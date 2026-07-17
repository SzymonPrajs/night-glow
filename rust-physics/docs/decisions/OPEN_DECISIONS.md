# Open architecture decisions

These decisions materially change the implementation and should be reviewed before scaffolding Rust source.

| ID | Decision | Options/questions | Evidence required |
|---|---|---|---|
| D-001 | Reference RT method | libRadtran-backed fixtures; internal discrete ordinates; successive orders; Monte Carlo hybrid | accuracy across clear/aerosol/cloud/horizon cases, license, runtime/cost |
| D-002 | Interactive transfer representation | Bruneton-style/precomputed atmosphere LUTs, Fourier operators, adaptive direct solve, hybrid | memory, source flexibility, horizon/terrain error, interpolation convergence |
| D-003 | Spectral basis | current 8 bands, denser fixed grid, adaptive bands, component basis | max errors for lamps, stars, Moon, gas features, observer functions |
| D-004 | Polarization | first release or deferred scalar model | effect on twilight/sky colour and complexity budget |
| D-005 | Earth/atmosphere geometry | spherical shells, oblate mapping, terrain-aware 2D/3D corrections | horizon and long-path error |
| D-006 | Star data products | Gaia filters, supplementary catalogues, LOD thresholds | completeness, licenses, browser size, total-flux convergence |
| D-007 | Diffuse Milky Way source | which calibrated surveys/derived products | absolute/spectral calibration, survey PSF, star subtraction, redistribution rights |
| D-008 | Ephemerides | DE440/441 coefficients, another validated compact representation | date range, Moon accuracy, data bytes, license |
| D-009 | Emission atlas integration | workspace crate, external versioned crate, serialized-provider boundary | ownership, release cadence, stable physical quantity |
| D-010 | Artificial-light inversion | source datasets and inference hierarchy | DNB response, ground truth, spectra/angular emission, uncertainty |
| D-011 | PSF scope | seeing only; atmosphere+instrument; eye/glare models | use cases, flux/encircled-energy validation, performance |
| D-012 | Wasm threads | required production header policy or optional tier | embedding/third-party constraints, browser measurements |
| D-013 | Runtime precision | `f64`, `f32`, mixed per kernel/product | convergence/parity error and memory/time measurements |
| D-014 | GPU compute | WebGL rendering only initially; selected validated shader kernels later | parity, portability, ownership/maintainability |
| D-015 | Product encoding | custom aligned binary, Arrow-like, KTX2 for textures, hybrid | streaming, range requests, decode/upload cost, schema evolution |

When resolved, create one short ADR per decision with context, decision, alternatives, consequences, evidence, and date/model revision. Do not edit this table to erase rejected alternatives; link the ADR and mark the row resolved.

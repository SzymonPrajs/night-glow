# Numerical methods and performance design

## 1. Accuracy before throughput

The numerical program starts with an `f64` reference path and explicit convergence harness. Optimized native and Wasm paths are accepted only after comparison on the same serialized scenarios. Speed is not evidence of correctness, and more pixels are not evidence of more physical resolution.

The error budget is decomposed into spectral quadrature, angular discretization, spatial/geographic LOD, vertical layering, time interpolation, scattering-order/iterative residual, catalogue truncation, source inversion, floating-point precision, LUT interpolation, PSF truncation, and display sampling.

## 2. Coordinate and sampling measures

All integrations attach weights for the actual measure:

- sphere: \(d\Omega=\cos e\,de\,d\phi\) in elevation/azimuth, or equal-area cell weights;
- surface: projected area and geodesic/ellipsoidal cell area;
- wavelength: response-weighted wavelength intervals;
- atmosphere: geometric path or optical-depth coordinates;
- PSF: solid-angle normalization, not unweighted pixel sum unless the projection makes them equivalent.

Grid layouts store weights and coordinate edges with values. Interpolation cannot invent a physical solve and is labelled separately from solved nodes.

## 3. Angular sky grid

The current application solves 720 azimuths, 22 adaptive physical elevations, and eight bands, then densifies to 128 render rows. That is a valuable regression fixture. The redesign should:

- retain adaptive concentration near the horizon;
- select nodes from measured transfer curvature/error;
- include exact solved rows in render products;
- use projection-aware interpolation and conservative tile borders;
- permit local refinement around Sun, Moon, bright artificial lobes, horizon discontinuities, and clouds;
- demonstrate convergence against denser direct samples.

The render grid may be much denser than the physical grid, but metadata must say which values were solved and which were reconstructed.

## 4. Spatial/geographic grids

Use hierarchical equal-area or well-characterized geospatial tiling for global products. Terrain may require a projected local high-resolution tier plus global curvature. Emission and surface products require conservative remapping: preserve total power/flux or area-weighted reflectance as appropriate, not pixel brightness.

Tile borders include the stencil/PSF/transport halo required at that LOD. Cross-LOD blending must conserve aggregate flux. Missing-data masks propagate separately from zero values.

Environment Atlas emission domain is a special input with a stricter invariant: its mixed-resolution H3 hierarchy conserves `J_DNB`, and no parent/descendant pair coexists. Physics uses H3 only for selection, then exact declared WGS84 support/area and source-local directions for propagation. Any Physics-side batching or source projection must preserve summed `J_DNB` before spectral/angular conversion within the atlas quantisation tolerance.

## 5. Spectral basis

Maintain a fine reference wavelength grid or trusted band integration for validation. The runtime basis may be:

- fixed narrow bands;
- an adaptive/nonuniform band set;
- basis coefficients learned/fitted from physically representative spectra;
- component-specific preintegration into shared response channels.

Selection is an optimization problem constrained by maximum error over solar/lunar/stellar continua, LED and sodium lines, Rayleigh/aerosol laws, gas absorption, surface reflectance, and observer functions. Eight current wavelengths are the initial comparison point. `f32` packing of coefficients is accepted band-by-band only after error measurement.

Environment Atlas emission domain retains its independently chosen source spectrum (currently proposed as 10 nm bins from 350–950 nm plus explicit narrow lines) and exact DNB response. The Physics projection operator is versioned and validated by both fine-grid error and DNB forward closure. Unresolved atlas spectra are not projected through a guessed basis; they produce insufficient-evidence, bound, or explicit-scenario results.

## 6. Radiative-transfer algorithms

The reference comparison should include at least one established solver. Candidate internal methods:

- successive orders of scattering for transparent bookkeeping and progressive refinement;
- discrete ordinates for layered, anisotropic multiple scattering;
- Monte Carlo for complex 3D/terrain/cloud validation, with variance reporting;
- precomputed atmospheric scattering/transmittance LUTs for interactive reuse;
- Fourier azimuth decomposition where symmetry and medium assumptions permit it.

The final design may be hybrid: native high-quality table construction, Wasm source projection/interpolation, and targeted interactive correction. LUT axes and interpolation are validated as a numerical method, not treated as free compression.

## 7. Convolution and transforms

The migration baseline uses 81 rings × 720 bearings × 22 elevations × 8 bands and a 2048-point zero-padded linear-convolution FFT, with a documented 111.5 MiB plan. The exact circular problem at 720 samples admits mixed-radix factorization \(720=2^4 3^2 5\), or alternative real FFT strategies. Research must benchmark:

- exact 720 real/mixed-radix circular convolution;
- current padded real transform;
- direct convolution for narrow kernels;
- spherical harmonic/needlet approaches for diffuse full-sky fields;
- spatially varying PSF bases or tiled convolution.

Acceptance includes numerical agreement, memory high-water mark, construction time, solve time, cancellation granularity, and Wasm SIMD behavior. A smaller plan is desirable only if circular indexing and conservation remain correct.

## 8. Precision

- Reference calculations default to `f64`.
- Precomputed published fields may be quantized only with per-product error tests and scale/offset metadata.
- Interactive math may use `f32` where error remains within the module budget.
- Optical depths, transmittance exponentials, long sums, and near-cancelling transforms may need `f64` or compensated/log-domain methods.
- GPU textures commonly use 16/32-bit floats, but the upload format is not the solver’s accuracy definition.

Native/Wasm parity tolerances are quantity-specific; bit identity is not generally required across different floating-point execution, while deterministic native asset builds should produce stable scientific hashes under a pinned toolchain/profile.

## 9. Progressive error-driven solve

Each job returns value, work completed, residual/error estimator, LOD, and dependencies. Refinement can increase scattering order, angular nodes, geographic LOD, spectral basis, catalogue magnitude tier, PSF support, or precision. Priority combines estimated visible error and physical contribution.

A result is publishable when required invariants pass and its error is below the chosen profile. Cancellation checks occur between bounded blocks. Partial internal iteration never enters the shared completed-result cache.

## 10. Memory and Wasm boundary

Large arrays stay in Wasm memory across several operations. JavaScript receives descriptors and typed views for final WebGL upload or diagnostics. The ABI batches stars/tiles/bands, preallocates reusable arenas, avoids per-frame allocation, and reports memory high-water marks.

Optional threads use shared linear memory and require cross-origin isolation. The single-worker path remains fully functional. Asset decoding/solve jobs should operate tilewise so a 32-bit Wasm address space and mobile memory pressure do not require the entire global catalogue or atlas resident at once.

The Environment Atlas emission decoder and Physics engine may share one coordinator worker without sharing a workspace or model revision. A decoder dependency can write a contiguous `SurfaceEmissionBatch` directly for the Physics adapter; separate Wasm modules may instead transfer/share the batch. Both paths are benchmarked against the same emission-domain conformance fixture and avoid per-cell JavaScript traffic.

## 11. GPU role

WebGL2 performs rasterization, interpolation, compositing, local convolution where validated, and display transforms. It is not assumed to be a general-compute dependency. Physics that naturally maps to fragment/vertex evaluation may later be mirrored in shaders only if parity/reference tests demonstrate equivalence and ownership remains in the Rust model specification.

High visual resolution requires device-pixel-aware render targets, adequate mesh/texture sampling, float HDR composition, correct filtering, and avoidance of 8-bit intermediate clamping. It cannot repair an under-resolved horizon transfer field.

# WebGL2 render contract

## 1. Division of responsibility

Rust/Wasm produces physically meaningful HDR resources. WebGL2 projects, samples, composites, optionally performs validated local filtering, and maps the final linear signal to the display. The renderer does not recompute ephemerides, atmospheric transport, light-pollution propagation, or source photometry.

## 2. Versioned products

Conceptual products include:

| Product | Contents | Typical GPU form |
|---|---|---|
| `sky_radiance` | diffuse spectral/basis radiance by direction | tiled 2D/cube/array float textures |
| `star_batch` | direction, spectral coefficients/flux, size/flags | stable interleaved VBO, instanced/batched draw |
| `body_batch` | Sun/Moon/planet disks and resolved parameters | small structured buffers/textures |
| `psf_basis` | normalized kernels/basis and spatial coefficients | float textures/uniform descriptors |
| `quality` | solved/interpolated LOD, masks, residuals | compact integer/float texture for diagnostics |

Every descriptor includes schema/model revision, coordinate projection, dimensions/strides, spectral basis ID, units/scale, scenario revision, LOD, valid region, tile border, and quality/error.

## 3. HDR and colour

- Accumulate in linear floating-point radiance/response space.
- Prefer `RGBA16F` or `RGBA32F` resources where required extensions and error tests permit; define packed/scaled fallback rather than silently using 8-bit sRGB.
- Convert spectral basis to the selected linear observer/sensor space through a declared matrix or shader basis evaluation.
- Apply exposure, adaptation/white balance, tone mapping, gamut mapping, and output transfer exactly once.
- Do not add a procedural glow that duplicates a physical radiance layer.

WebGL feature detection must test renderability, filtering, blending, and read/use behavior actually required—not only extension strings.

## 4. Resolution and sampling

The canvas uses device-pixel-aware sizing with an explicit maximum memory/performance policy. Physics texture resolution is chosen by projected radiance/gradient error, not automatically equated with screen pixels. Near-horizon and bright-source regions can receive more physical samples; smooth zenith regions can use lower LOD.

Tile borders cover interpolation/filter kernels. LOD transitions conserve radiance and avoid seams. Renderer interpolation is labelled as reconstruction. If a coarse physical grid is visible as blocks, merely increasing canvas resolution will sharpen the blocks.

## 5. Stars and finite bodies

Stars use stable batches/VBOs with frustum/magnitude/LOD selection performed before or during upload. One JavaScript/Three object per star is prohibited. Point sprites or instanced quads integrate flux consistently across size/LOD and pass through wavelength-dependent PSF handling.

Sun, Moon, and resolved planets are finite disks where angular size matters. Their direct disk, atmospheric halo, physical PSF, and aesthetic display bloom remain separable for diagnostics.

## 6. PSF

Several strategies may coexist after validation:

- analytic/basis evaluation for isolated stars;
- binned/tiled convolution for dense star fields;
- mip/needlet or prefiltered diffuse maps according to source survey and atmospheric response;
- spatially varying kernels near horizon or across large fields.

The kernel is normalized under the projection’s solid-angle measure. Truncation energy is accounted for. Artistic bloom never substitutes for missing physical PSF wings.

## 7. Upload and lifetime

- Upload only completed products for the current scenario revision.
- Reuse GPU allocations and update subregions/tiles.
- Use double-buffer or atomic tile replacement to avoid mixed revisions.
- Dispose obsolete buffers/textures after GPU-safe handoff.
- Track allocated bytes and refuse/degrade gracefully under budget pressure.
- Keep enough HDR state that exposure/display-only changes do not trigger physics.

## 8. Browser compatibility tiers

The renderer declares capabilities and chooses a fidelity profile. Minimum target remains WebGL2. Optional float filtering/blending/timer-query paths have fallbacks. WebGPU is not required by this architecture and can be evaluated later as another rendering/compute target without relocating physics ownership.

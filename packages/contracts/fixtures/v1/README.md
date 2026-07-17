# Contract fixture v1

These tiny JSON products are the first language-neutral Night Glow conformance
set. They are synthetic, contain no third-party data, and are dedicated to the
public domain under CC0-1.0.

The fixture intentionally exercises product identity, quantities, units, axis
order, validity/evidence, pinned scenario revisions and a coherent render-product
barrier. It is not a calibrated atmosphere or sky prediction.

Run `make contract-check` to validate structure, cross-product identities,
emission conservation, atmospheric level ordering and render-buffer lengths.

Files:

- `conventions.json`: frozen coordinate, time and wavelength conventions;
- `emission-release.json`: four exact-support synthetic surface cells;
- `atmosphere-release.json`: one 2×2×3 atmosphere state volume;
- `environment-display-products.json`: independent emission and atmosphere map derivatives;
- `observer-scenario.json`: a complete scenario with independently pinned inputs;
- `observer-render-product.json`: one coherent linear-HDR coarse result.
- `manifest.json`: licence and SHA-256 identities for every fixture payload.

The corresponding public descriptor shapes live in
[`../../schemas/v1`](../../schemas/v1/README.md). Physics-owned fixture assets,
including the flat terrain product and response-basis manifest, live under
[`packages/physics/fixtures/v1`](../../../physics/fixtures/v1/).

# Physics fixtures and references

These tracked files provide small, reviewable inputs and independent reference
values for Physics tests. They are not generated build output.

- `jpl-horizons-v1.json` contains independent astronomy vectors used to check
  time/location geometry.
- `v1/physics-data-manifest.json` and `v1/surface-terrain-product.json` identify
  the synthetic first-slice optical and terrain inputs.
- `v1/libradtran-pure-absorption.json` records accepted reference values,
  tolerances, provenance and hashes for the validation cases.
- `reference/libradtran-2.0.6-pure-absorption-v1/` contains the tiny exact input
  and output artifacts needed to reproduce those reference values. It does not
  contain the libRadtran program or a downloaded scientific dataset.

Native validation, Wasm checks and reproducibility checks load these files.
Keeping them in Git makes scientific comparisons reviewable and prevents a
local machine's unstated files from deciding whether the implementation passes.
